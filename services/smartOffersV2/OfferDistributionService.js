const PersonalizedOffer = require("../../models/PersonalizedOffer");

class OfferDistributionService {
  /**
   * Sélectionne la meilleure offre parmi celles d'une règle, selon sa méthode de distribution.
   * @param {Object} userContext - Stats et informations de l'utilisateur.
   * @param {Object} rule - L'objet DynamicRule.
   * @returns {Object|null} L'offre sélectionnée ou null si aucune n'est applicable.
   */
  static async selectOffer(userContext, rule) {
    if (!rule.offers || rule.offers.length === 0) return null;

    // S'il n'y a qu'une seule offre, pas besoin de logique de distribution complexe
    if (rule.offers.length === 1) return rule.offers[0];

    switch (rule.distributionMethod) {
      case "waterfall":
        return this.handleWaterfall(userContext, rule);
      case "success_sequence":
        return this.handleSuccessSequence(userContext, rule);
      case "scenario_journey":
        return this.handleScenarioJourney(userContext, rule);
      case "weighted_random":
        return this.handleWeightedRandom(rule);
      case "multi_armed_bandit":
        return this.handleMultiArmedBandit(rule);
      case "fatigue_control":
        return this.handleFatigueControl(userContext, rule);
      case "engagement_split":
        return this.handleEngagementSplit(userContext, rule);
      case "priority":
      default:
        // Par défaut: on retourne la première offre valide
        return rule.offers[0];
    }
  }

  /**
   * Escalade : Si l'utilisateur a ignoré l'offre de niveau N, on passe à N+1.
   */
  static async handleWaterfall(userContext, rule) {
    // 1. Trier les offres par niveau (waterfallLevel)
    const sortedOffers = [...rule.offers].sort((a, b) => (a.waterfallLevel || 1) - (b.waterfallLevel || 1));
    
    // 2. Trouver la dernière offre envoyée à cet utilisateur pour cette campagne/règle
    const lastOfferDoc = await PersonalizedOffer.findOne({
      user: userContext.user._id,
      dynamicRule: rule._id,
      // Offre annulée avant activation : le client ne l'a jamais reçue.
      status: { $ne: "replaced" },
    }).sort({ createdAt: -1 });

    if (!lastOfferDoc) {
      // Jamais reçu d'offre pour cette règle : on commence au niveau 1
      return sortedOffers[0];
    }

    // A-t-il converti la dernière offre ?
    if (["applied"].includes(lastOfferDoc.status)) {
      // Retour à la case départ
      return sortedOffers[0];
    }

    // Sinon, l'a-t-il ignorée suffisamment longtemps ?
    // Trouver quelle config correspond à la dernière offre
    const lastConfigIndex = sortedOffers.findIndex(
      (o) => String(o._id) === String(lastOfferDoc.offerConfigId) // Assuming we save offerConfigId
    );

    const currentConfig = sortedOffers[lastConfigIndex !== -1 ? lastConfigIndex : 0];
    
    const delayDays = currentConfig.waterfallDelayDays || 3;
    const daysSinceLastOffer = (Date.now() - new Date(lastOfferDoc.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastOffer >= delayDays) {
      // On passe au niveau suivant s'il existe
      const nextIndex = lastConfigIndex + 1;
      return nextIndex < sortedOffers.length ? sortedOffers[nextIndex] : sortedOffers[sortedOffers.length - 1];
    }

    // Pas encore prêt à escalader (en cooldown ou encore valide)
    // On pourrait retourner null pour ne pas spammer, ou renvoyer la même offre
    return null;
  }

  /**
   * Success Sequence (Follow-up) : Contraire du waterfall. 
   * On passe à l'offre N+1 SEULEMENT SI le client a utilisé/converti l'offre N.
   */
  static async handleSuccessSequence(userContext, rule) {
    // 1. Trier les offres par niveau
    const sortedOffers = [...rule.offers].sort((a, b) => (a.waterfallLevel || 1) - (b.waterfallLevel || 1));
    
    // 2. Trouver la dernière offre envoyée
    const lastOfferDoc = await PersonalizedOffer.findOne({
      user: userContext.user._id,
      dynamicRule: rule._id,
      // Offre annulée avant activation : le client ne l'a jamais reçue.
      status: { $ne: "replaced" },
    }).sort({ createdAt: -1 });

    if (!lastOfferDoc) {
      // Jamais reçu : on commence au niveau 1
      return sortedOffers[0];
    }

    const lastConfigIndex = sortedOffers.findIndex(
      (o) => String(o._id) === String(lastOfferDoc.offerConfigId)
    );

    // S'il l'a utilisée, on donne le follow-up (N+1)
    if (["applied"].includes(lastOfferDoc.status)) {
      const nextIndex = lastConfigIndex + 1;
      // S'il est arrivé à la fin, on peut décider de recommencer ou de s'arrêter.
      // Par défaut, on recommence la boucle de follow-up.
      return nextIndex < sortedOffers.length ? sortedOffers[nextIndex] : sortedOffers[0];
    }

    // S'il ne l'a PAS utilisée, que faire ?
    // Option A : on le laisse sur la même étape jusqu'à ce qu'il l'utilise.
    const currentConfig = sortedOffers[lastConfigIndex !== -1 ? lastConfigIndex : 0];
    
    // Optionnel : ne la relancer que si le cooldown de la règle est passé
    // (Le validateur global s'en chargera, on peut donc simplement retourner l'offre actuelle)
    return currentConfig;
  }

  /**
   * Scenario Journey : Arbre de décision customisé avec liens directs.
   */
  static async handleScenarioJourney(userContext, rule) {
    // S'assurer qu'on a des offres
    if (!rule.offers || rule.offers.length === 0) return null;

    // 1. Trouver la dernière offre envoyée pour ce scénario
    const lastOfferDoc = await PersonalizedOffer.findOne({
      user: userContext.user._id,
      dynamicRule: rule._id,
      // Offre annulée avant activation : le client ne l'a jamais reçue.
      status: { $ne: "replaced" },
    }).sort({ createdAt: -1 });

    if (!lastOfferDoc) {
      // Jamais reçu d'offre pour ce scénario.
      // On cherche l'offre marquée comme "isRoot". Si aucune, on prend la première.
      const rootOffer = rule.offers.find((o) => o.isRoot) || rule.offers[0];
      return rootOffer;
    }

    // Trouver la config de la dernière offre
    const lastConfig = rule.offers.find((o) => String(o._id) === String(lastOfferDoc.offerConfigId));
    if (!lastConfig) {
      // Configuration supprimée, on repart du début ou on arrête.
      return rule.offers.find((o) => o.isRoot) || rule.offers[0];
    }

    // Vérifier l'état de la dernière offre
    const isUsed = ["applied"].includes(lastOfferDoc.status);
    
    // Si l'offre est toujours valide (ni utilisée ni expirée), on renvoie null pour ne pas en recréer
    // En supposant qu'une offre "préparée", "active", "viewed" n'est pas encore finie
    if (!isUsed && !["expired", "ignored"].includes(lastOfferDoc.status)) {
      // Pour forcer le passage à ignoré, il faut attendre sa validité (handled elsewhere ou ici avec un delay)
      const delayDays = lastConfig.waterfallDelayDays || 3;
      const daysSinceLastOffer = (Date.now() - new Date(lastOfferDoc.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastOffer < delayDays) {
        return null; // En attente
      }
    }

    // L'offre a été utilisée ou le délai est dépassé (considérée comme ignorée)
    const nextStepId = isUsed ? lastConfig.nextStepOnAccept : lastConfig.nextStepOnIgnore;
    const nextOffer = nextStepId ? rule.offers.find((o) => o.stepId === nextStepId) : null;
    if (nextOffer) return nextOffer;

    // Scénario terminé : on n'arrive ici que si le client correspond ENCORE à la règle (la suite
    // d'un scénario en cours est donnée sans réévaluation, voir getScenarioContinuation) → le
    // scénario recommence depuis le début.
    return rule.offers.find((o) => o.isRoot) || rule.offers[0];
  }

  /**
   * Scénario en cours : si la DERNIÈRE offre reçue par le client vient d'un scénario actif qui a
   * une étape suivante, cette étape lui est donnée directement, SANS réévaluer les conditions de
   * la règle ni le comparer aux autres règles. Le client va ainsi au bout de son scénario.
   * Renvoie { rule, offer } ou null (pas de scénario en cours, ou scénario terminé).
   */
  static async getScenarioContinuation(userContext, activeRules = []) {
    const userId = userContext?.user?._id;
    if (!userId) return null;
    const lastOffer = await PersonalizedOffer.findOne({
      user: userId,
      dynamicRule: { $ne: null },
      isDeferredReward: { $ne: true },
      status: { $ne: "replaced" },
    })
      .sort({ createdAt: -1 })
      .select("dynamicRule offerConfigId status")
      .lean();
    if (!lastOffer) return null;

    const rule = activeRules.find(
      (r) => String(r._id) === String(lastOffer.dynamicRule) && r.distributionMethod === "scenario_journey",
    );
    if (!rule?.offers?.length) return null;
    const lastConfig = rule.offers.find((o) => String(o._id) === String(lastOffer.offerConfigId));
    if (!lastConfig) return null;

    // Offre encore en cours (préparée, active…) : le scan ignore déjà ce client.
    const isUsed = lastOffer.status === "applied";
    if (!isUsed && !["expired", "ignored"].includes(lastOffer.status)) return null;

    const nextStepId = isUsed ? lastConfig.nextStepOnAccept : lastConfig.nextStepOnIgnore;
    const nextOffer = nextStepId ? rule.offers.find((o) => o.stepId === nextStepId) : null;
    return nextOffer ? { rule, offer: nextOffer } : null;
  }

  /**
   * Distribution Pondérée
   */
  static handleWeightedRandom(rule) {
    const totalWeight = rule.offers.reduce((sum, o) => sum + (o.weight || 0), 0);
    if (totalWeight === 0) return rule.offers[0];

    let random = Math.random() * totalWeight;
    for (const offer of rule.offers) {
      random -= (offer.weight || 0);
      if (random <= 0) return offer;
    }
    return rule.offers[0];
  }

  /**
   * Rotation Anti-Lassitude : Si l'offre A a été envoyée 2 fois sans conversion, on passe à B.
   */
  static async handleFatigueControl(userContext, rule) {
    // Récupérer les X dernières offres pour cette règle
    // (dynamicRule, pas rule : ce dernier ne référence que les anciennes SmartOfferRule V1
    // et reste toujours null pour les offres V2, ce qui rendait cette requête toujours vide)
    const recentOffers = await PersonalizedOffer.find({
      user: userContext.user._id,
      dynamicRule: rule._id,
      status: { $ne: "replaced" },
    }).sort({ createdAt: -1 }).limit(3);

    if (recentOffers.length >= 2) {
      const last = recentOffers[0];
      const prev = recentOffers[1];

      // Si les deux dernières offres étaient identiques et non converties (status "ignored" ou "expired")
      if (
        String(last.offerConfigId) === String(prev.offerConfigId) &&
        !["applied"].includes(last.status) &&
        !["applied"].includes(prev.status)
      ) {
        // Force une offre différente
        const alternativeOffers = rule.offers.filter((o) => String(o._id) !== String(last.offerConfigId));
        if (alternativeOffers.length > 0) {
          // On prend la première alternative (ou on pourrait appliquer un random)
          return alternativeOffers[0];
        }
      }
    }

    // Comportement par défaut (ex: la première offre, ou un random simple)
    return rule.offers[0];
  }

  /**
   * Split selon l'engagement (Taux d'ouverture)
   */
  static handleEngagementSplit(userContext, rule) {
    // Si l'utilisateur ouvre beaucoup ses notifs (ex: > 30%)
    const openRate = userContext.openRate || 0;
    
    if (openRate > 0.3) {
      // Utilisateur engagé : on donne l'offre standard (la première)
      return rule.offers[0];
    } else {
      // Utilisateur dormant : on donne l'offre agressive (la dernière du tableau)
      return rule.offers[rule.offers.length - 1];
    }
  }

  /**
   * Multi-Armed Bandit (A/B Testing IA, Epsilon-Greedy).
   * La version gagnante est désignée toutes les 2 semaines par BanditOptimizationService et
   * enregistrée sur la règle : elle est donnée dans 85 % des cas, les 15 % restants testent
   * une autre version. Tant qu'aucune gagnante n'est désignée (pas assez de données), toutes
   * les versions sont données à parts égales.
   */
  static handleMultiArmedBandit(rule) {
    const EPSILON = 0.15;
    const pickRandom = (offers) => offers[Math.floor(Math.random() * offers.length)];

    const winnerId = rule.banditEvaluation?.winnerOfferConfigId;
    const winner = winnerId ? rule.offers.find((o) => String(o._id) === String(winnerId)) : null;
    if (!winner) return pickRandom(rule.offers);

    if (Math.random() < EPSILON) {
      const others = rule.offers.filter((o) => o !== winner);
      return others.length ? pickRandom(others) : winner;
    }
    return winner;
  }
}

module.exports = OfferDistributionService;
