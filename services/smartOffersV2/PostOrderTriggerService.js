const mongoose = require("mongoose");
const User = require("../../models/User");
const Order = require("../../models/Order");
const Category = require("../../models/Category");
const Campaign = require("../../models/Campaign");
const DynamicRule = require("../../models/DynamicRule");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const RuleEvaluatorService = require("./RuleEvaluatorService");
const OfferDistributionService = require("./OfferDistributionService");
const {
  getScheduledNotifyAt,
  getTorontoWallClockUtc,
  getPartsInTimezone,
} = require("./ProfilingService");

/**
 * Ré-évalue instantanément les Smart Offers pour un utilisateur donné.
 * Ceci est appelé juste après la confirmation d'une commande.
 * Le but est de permettre l'escalade (Waterfall) ou d'attribuer une nouvelle offre
 * si le statut de l'utilisateur a changé (ex: 2e commande passée).
 */
async function evaluateUserSmartOffers(userId) {
  try {
    const user = await User.findById(userId).lean();
    if (!user || user.isBanned) return;

    // 1. Récupérer l'historique des commandes
    const orders = await Order.find({
      user: userId,
      confirmed: true,
      status: { $nin: ["canceled", "cancelled"] }
    }).sort({ createdAt: -1 }).lean();

    const now = new Date();
    
    // 2. Calcul des stats basiques (similaire au cron, mais plus léger)
    const orderCount = orders.length;
    const lastOrderAt = orderCount > 0 ? orders[0].createdAt : null;
    const recencyDays = lastOrderAt ? Math.floor((now - new Date(lastOrderAt)) / 86400000) : 999;
    
    const accountCreatedAt = user.createdAt ? new Date(user.createdAt) : null;
    const accountAgeDays = accountCreatedAt ? (now.getTime() - accountCreatedAt.getTime()) / 86400000 : null;

    let preferredHour = 12;
    // (Une implémentation complète calculerait le "mode" des heures de commande ici)
    if (orderCount > 0) {
      // Simplification : prendre l'heure de la dernière commande comme référence
      preferredHour = new Date(lastOrderAt).getHours(); 
    }

    const userStatsContext = {
      user,
      orders,
      orderCount,
      recencyDays,
      accountAgeDays,
      openRate: 0, // Idéalement calculé depuis les events
      // ... Les autres stats seront calculées dynamiquement par extractCriteriaValue si besoin
    };

    // 3. Charger les campagnes et règles actives
    const activeCampaigns = await Campaign.find({ isActive: true }).lean();
    const activeCampaignIds = activeCampaigns.map(c => c._id);
    const activeDynamicRules = await DynamicRule.find({ 
      isActive: true, 
      campaign: { $in: activeCampaignIds } 
    }).populate("campaign").lean();

    activeDynamicRules.sort((a, b) => (b.weight || 0) - (a.weight || 0));

    // 3b. Gestion des offres existantes
    const existingOffers = await PersonalizedOffer.find({
      user: userId,
      status: { $in: ["prepared", "active", "viewed", "clicked"] }
    }).lean();

    const preparedOffers = existingOffers.filter(o => o.status === "prepared" && !o.isDeferredReward);
    const hasDeferredReward = existingOffers.some(o => o.isDeferredReward && ["prepared", "active", "viewed", "clicked"].includes(o.status));
    const activeOffers = existingOffers.filter(o => ["active", "viewed", "clicked"].includes(o.status));
    
    if (hasDeferredReward) {
      console.log(`[evaluateUserSmartOffers] Le client ${userId} a un cashback différé (récompense) en attente ou actif. Aucune offre concurrente ne sera générée.`);
      return;
    }

    const hasAnyAttachedOffer = existingOffers.length > 0 || orders[0]?.personalizedOffer;

    // Recalcul du cooldown si une offre vient d'être utilisée ou ignorée lors de cette commande
    // confirmOrderService vient juste de modifier ces offres (updatedAt: maintenant)
    const recentTriggerOffer = await PersonalizedOffer.findOne({
      user: userId,
      status: { $in: ["applied", "ignored"] },
      updatedAt: { $gte: new Date(now.getTime() - 60000) } // Modifiée dans la dernière minute
    }).populate({ path: "dynamicRule", populate: { path: "campaign" } }).lean();

    if (recentTriggerOffer) {
      let cooldownDays = 7;
      
      if (recentTriggerOffer.dynamicRule && recentTriggerOffer.dynamicRule.offers) {
        const offerConfig = recentTriggerOffer.dynamicRule.offers.find(
          o => String(o._id) === String(recentTriggerOffer.offerConfigId)
        );
        if (offerConfig && offerConfig.cooldownDays !== undefined) {
          cooldownDays = offerConfig.cooldownDays;
        } else if (recentTriggerOffer.dynamicRule.campaign?.defaultCooldownDays !== undefined) {
          cooldownDays = recentTriggerOffer.dynamicRule.campaign.defaultCooldownDays;
        }
      }

      user.smartOfferCooldownEndsAt = new Date(now.getTime() + (cooldownDays * 86400000));
      await User.findByIdAndUpdate(userId, { smartOfferCooldownEndsAt: user.smartOfferCooldownEndsAt });
      console.log(`[evaluateUserSmartOffers] Cooldown recalculé suite à commande (applied/ignored) : fin prévue le ${user.smartOfferCooldownEndsAt}`);
    }

    // 4. Arbre de décision : Faut-il évaluer le profil ?
    const isInCooldown = user.smartOfferCooldownEndsAt && new Date(user.smartOfferCooldownEndsAt) > now;
    let shouldEvaluate = false;

    if (recentTriggerOffer) {
      shouldEvaluate = true; // Cas 1: Il vient d'utiliser/ignorer une offre, on doit évaluer la suite (N+1)
    } else if (preparedOffers.length > 0) {
      shouldEvaluate = true; // Cas 2: Il a une offre en attente, sa commande pourrait l'invalider
    } else if (!isInCooldown) {
      shouldEvaluate = true; // Cas 3: Il n'est pas en cooldown, commande naturelle
    }

    if (!shouldEvaluate) {
      // S'il n'a aucune offre en jeu et est en cooldown, on ne fait rien
      return;
    }

    // Les offres "active", "viewed", "clicked" ont déjà été passées à "ignored" ou "applied" 
    // par confirmOrderService.js juste avant l'appel à ce service.
    // Les offres "prepared" ont été épargnées pour préserver les scénarios.
    
    const candidates = [];

    // 5. Évaluation
    for (const rule of activeDynamicRules) {
      if (RuleEvaluatorService.evaluate(userStatsContext, rule)) {
        const selectedOffer = await OfferDistributionService.selectOffer(userStatsContext, rule);
        if (selectedOffer) {
          candidates.push({
            ...selectedOffer,
            score: rule.weight || 0,
            dynamicRuleId: rule._id,
            campaignId: rule.campaign?._id,
          });
        }
      }
    }

    if (candidates.length === 0) {
      // Le client ne se qualifie plus pour AUCUNE règle suite à sa commande.
      // Si on avait une offre préparée en attente, on l'invalide car il n'est plus éligible à rien.
      if (preparedOffers.length > 0) {
        for (const pOffer of preparedOffers) {
          await PersonalizedOffer.findByIdAndUpdate(pOffer._id, { status: "invalid", updatedAt: new Date() });
        }
      }
      return;
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0];

    // Gestion des offres programmées (si le client en avait déjà une)
    if (preparedOffers.length > 0) {
      for (const pOffer of preparedOffers) {
        if (String(pOffer.dynamicRule) !== String(selected.dynamicRuleId)) {
          // Appartient à une NOUVELLE règle -> on invalide l'ancienne programmée
          await PersonalizedOffer.findByIdAndUpdate(pOffer._id, { status: "invalid", updatedAt: new Date() });
        } else {
          // Appartient à la MÊME règle -> elle reste programmée, pas besoin de recréer
          return;
        }
      }
    }

    // Calcul de l'heure d'envoi
    let notifyHour = preferredHour - 1;
    if (notifyHour < 8 || notifyHour > 21) notifyHour = 11;
    
    if (selected.notifyAtHour !== undefined && selected.notifyAtHour !== null && selected.notifyAtHour !== "") {
      notifyHour = Number(selected.notifyAtHour);
    }
    
    // Le point de départ est maintenant (l'offre sera programmée pour la date prévue sans délai artificiel)
    const baseDate = new Date(now.getTime());
    
    let scheduledNotifyAt = getScheduledNotifyAt(baseDate, notifyHour);
    let validFrom = null;

    if (selected.notifyOnDays && selected.notifyOnDays.length > 0) {
      const { day: today, hour: currentHour } = getPartsInTimezone(baseDate);
      let daysToAdd = 7;

      for (const d of selected.notifyOnDays) {
        let diff = (d - today + 7) % 7;
        if (diff === 0 && currentHour >= notifyHour) {
          diff = 7;
        }
        if (diff < daysToAdd) daysToAdd = diff;
      }

      const nextDate = new Date(baseDate.getTime() + daysToAdd * 86400000);
      scheduledNotifyAt = getTorontoWallClockUtc(nextDate, notifyHour);
      validFrom = getTorontoWallClockUtc(nextDate, 0);
    }

    // Calcul de smartOfferCooldownEndsAt : date d'activation + durée + cooldown
    const validityHours = selected.validityHours || 24;
    const cooldownDays = selected.cooldownDays || selected.campaign?.defaultCooldownDays || 7;
    const smartOfferCooldownEndsAt = new Date(scheduledNotifyAt.getTime() + (validityHours * 3600000) + (cooldownDays * 86400000));


    // 5. Créer la nouvelle offre
    const newOffer = new PersonalizedOffer({
      user: userId,
      dynamicRule: selected.dynamicRuleId,
      campaign: selected.campaignId,
      offerConfigId: selected._id,
      status: "prepared",
      offerType: selected.offerType,
      discountValue: selected.discountValue || 0,
      bonusThreshold: selected.bonusThreshold || 0,
      bonusPoints: selected.bonusPoints,
      discountSteps: selected.discountSteps,
      followupValidityDays: selected.followupValidityDays,
      triggerItem: selected.triggerItem,
      triggerItemSize: selected.triggerItemSize,
      giftItemSize: selected.giftItemSize,
      targetCategory: selected.targetCategory || null,
      targetMenuItem: selected.targetMenuItem || null,
      freeItem: selected.freeItem || null,
      freeItems: selected.freeItems || [],
      scheduledNotifyAt,
      validFrom,
      validityHours: selected.validityHours,
      notifyOnDays: selected.notifyOnDays || [],
      notifyAtHour: selected.notifyAtHour !== undefined ? selected.notifyAtHour : null,
      notificationTitle: selected.notificationTitle,
      notificationBody: selected.notificationBody,
      score: selected.score,
      deferredThreshold: selected.deferredThreshold,
      deferredDiscountValue: selected.deferredDiscountValue,
      deferredValidityDays: selected.deferredValidityDays,
      deferredActivationRule: selected.deferredActivationRule,
      tieredDiscounts: selected.tieredDiscounts,
      mysteryThreshold: selected.mysteryThreshold,
      mysteryItemName: selected.mysteryItemName,
    });

    await newOffer.save();
    
    // Mettre à jour le User avec sa date de fin de cooldown
    await User.findByIdAndUpdate(userId, { smartOfferCooldownEndsAt });
    
    console.log(`[evaluateUserSmartOffers] Nouvelles offre post-commande préparée pour l'utilisateur ${userId}`);
    
  } catch (error) {
    console.error("[evaluateUserSmartOffers] Erreur lors de la réévaluation post-commande :", error);
  }
}

module.exports = {
  evaluateUserSmartOffers,
};
