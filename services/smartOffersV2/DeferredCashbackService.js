// Cashback différé (deferred_cashback) : la commande qui atteint le seuil "consomme" l'offre
// sans rabais immédiat ; à sa CONFIRMATION, on crée la récompense : un rabais panier
// (discount_order, isDeferredReward) programmé selon deferredActivationRule. Le job
// triggerScheduledOffersJob l'active et la notifie à sa date, comme toute offre "prepared".
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const { getTorontoWallClockUtc, getPartsInTimezone } = require("./ProfilingService");
const {
  calculateSmartOfferValidUntil,
  formatSmartOfferDeadline,
} = require("../../utils/smartOfferNotificationBody");

const ACTIVATION_HOUR = 10; // heure de Toronto à laquelle une récompense programmée devient active
const DAY_BY_RULE = {
  next_monday: 1,
  next_week: 1,
  next_tuesday: 2,
  next_wednesday: 3,
  next_thursday: 4,
  next_friday: 5,
  next_saturday: 6,
  next_sunday: 0,
};

/** Date d'activation de la récompense selon la règle de l'offre (heure de Toronto). */
const getDeferredActivationDate = (offer, now = new Date()) => {
  const rule = offer?.deferredActivationRule || "immediate";
  if (rule === "immediate") return now;

  const { day: today } = getPartsInTimezone(now);
  const atDayOffset = (offset) =>
    getTorontoWallClockUtc(new Date(now.getTime() + offset * 86400000), ACTIVATION_HOUR);

  if (rule === "next_weekend") {
    // Déjà le week-end : la récompense est disponible tout de suite.
    if (today === 6 || today === 0) return now;
    return atDayOffset(6 - today);
  }

  const targetDay = DAY_BY_RULE[rule] ?? (Number.isInteger(offer?.deferredTargetDay) ? offer.deferredTargetDay : null);
  if (targetDay === null) return now;
  const offset = ((targetDay - today + 7) % 7) || 7; // toujours le PROCHAIN jour visé
  return atDayOffset(offset);
};

/** « mardi 6 octobre » (heure de Toronto). */
const formatOrderDay = (date) =>
  new Date(date).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Toronto",
  });

/** Crée la récompense d'un cashback dont la commande vient d'être confirmée (idempotent). */
const createDeferredCashbackReward = async (sourceOfferId) => {
  const source = await PersonalizedOffer.findById(sourceOfferId).lean();
  if (!source || source.offerType !== "deferred_cashback") return null;

  const existing = await PersonalizedOffer.findOne({ deferredSourceOffer: source._id }).lean();
  if (existing) return existing;

  const percent = Number(source.deferredDiscountValue) || 0;
  if (percent <= 0) return null;

  const validityDays = Math.max(1, Number(source.deferredValidityDays) || 7);
  const scheduledNotifyAt = getDeferredActivationDate(source);

  const reward = await PersonalizedOffer.create({
    user: source.user,
    dynamicRule: source.dynamicRule || null,
    campaign: source.campaign || null,
    offerConfigId: source.offerConfigId || null,
    rule: null,
    status: "prepared",
    offerType: "discount_order",
    discountValue: percent,
    bonusThreshold: 0,
    excludedCategories: source.excludedCategories || [],
    isDeferredReward: true,
    deferredSourceOffer: source._id,
    scheduledNotifyAt,
    validityHours: validityDays * 24,
    notificationTitle: `Votre rabais de ${percent} % est disponible !`,
    // Envoyée plusieurs jours après la commande : on la date pour que le client s'y retrouve.
    notificationBody: `Grâce à votre commande du ${formatOrderDay(new Date())}, profitez de ${percent} % de rabais sur votre prochaine commande.`,
    strategyId: source.strategyId || null,
  });

  // Activation différée : on confirme tout de suite au client que son rabais est acquis et
  // à partir de quand il pourra l'utiliser. Le jour J, triggerScheduledOffersJob envoie la
  // notification d'activation. Activation immédiate : cette dernière suffit.
  if (scheduledNotifyAt.getTime() > Date.now() + 60000) {
    sendDeferredCashbackConfirmedNotification(reward).catch((error) =>
      console.error("[deferredCashback] Notification de confirmation:", error.message),
    );
  }

  return reward;
};

const sendDeferredCashbackConfirmedNotification = async (reward) => {
  // require tardif : SplitDiscountNotificationService charge des modèles et services de mail.
  const { notifyUser } = require("./SplitDiscountNotificationService");
  const percent = Number(reward.discountValue) || 0;
  // Même calcul que l'activation (triggerScheduledOffersJob) : expiration à 23:59 Toronto.
  const validUntil = calculateSmartOfferValidUntil(reward.scheduledNotifyAt, reward.validityHours);
  const body =
    `Merci pour votre commande ! Votre rabais de ${percent} % sera utilisable du ` +
    `${formatSmartOfferDeadline(reward.scheduledNotifyAt)} au ${formatSmartOfferDeadline(validUntil)}.`;
  await notifyUser(reward.user, reward._id, `Votre rabais de ${percent} % est réservé`, body, {
    type: "deferred_cashback_confirmed",
    offerId: String(reward._id),
    userId: String(reward.user),
  });
};

/** Commande annulée : la récompense pas encore activée disparaît, le cashback redevient utilisable. */
const restoreDeferredCashbackOnCancel = async (order) => {
  const offerId = order?.personalizedOffer;
  if (!offerId) return;
  const source = await PersonalizedOffer.findById(offerId).select("offerType status validUntil");
  if (!source || source.offerType !== "deferred_cashback") return;

  await PersonalizedOffer.deleteMany({ deferredSourceOffer: source._id, status: "prepared" });
  if (source.status === "applied") {
    source.status = source.validUntil && source.validUntil > new Date() ? "active" : "expired";
    await source.save();
  }
};

module.exports = {
  getDeferredActivationDate,
  createDeferredCashbackReward,
  restoreDeferredCashbackOnCancel,
};
