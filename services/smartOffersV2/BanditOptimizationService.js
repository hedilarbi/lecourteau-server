const DynamicRule = require("../../models/DynamicRule");
const PersonalizedOffer = require("../../models/PersonalizedOffer");

class BanditOptimizationService {
  /**
   * Analyse les règles en mode multi_armed_bandit.
   * S'il y a un gagnant clair, on remplace toutes les offres `prepared` des clients
   * par l'offre gagnante.
   */
  static async optimizeRules() {
    try {
      console.log(`[BanditOptimizationService] Démarrage de l'optimisation A/B Testing...`);
      const activeBanditRules = await DynamicRule.find({ 
        isActive: true, 
        distributionMethod: "multi_armed_bandit" 
      });

      for (const rule of activeBanditRules) {
        if (!rule.offers || rule.offers.length <= 1) continue;

        let bestOffer = null;
        let bestConversionRate = -1;
        let enoughData = false;

        for (const offer of rule.offers) {
          const totalSent = await PersonalizedOffer.countDocuments({
            dynamicRule: rule._id,
            offerConfigId: offer._id,
          });

          if (totalSent >= 20) { // Seuil minimal pour statuer
            enoughData = true;
            const totalUsed = await PersonalizedOffer.countDocuments({
              dynamicRule: rule._id,
              offerConfigId: offer._id,
              status: { $in: ["used", "applied"] }
            });
            const rate = totalUsed / totalSent;
            if (rate > bestConversionRate) {
              bestConversionRate = rate;
              bestOffer = offer;
            }
          }
        }

        // Si on a assez de données et un gagnant
        if (enoughData && bestOffer) {
          console.log(`[BanditOptimizationService] Règle ${rule._id} : Offre gagnante ${bestOffer._id} (${(bestConversionRate*100).toFixed(1)}%)`);
          
          // Trouver toutes les offres préparées pour cette règle, qui ne sont pas la gagnante
          const pendingOffers = await PersonalizedOffer.find({
            dynamicRule: rule._id,
            status: "prepared",
            isDeferredReward: { $ne: true },
            offerConfigId: { $ne: bestOffer._id }
          });

          if (pendingOffers.length > 0) {
            console.log(`[BanditOptimizationService] -> Remplacement de ${pendingOffers.length} offres préparées par l'offre gagnante.`);
            
            for (const pending of pendingOffers) {
              await PersonalizedOffer.updateOne({ _id: pending._id }, {
                $set: {
                  offerConfigId: bestOffer._id,
                  offerType: bestOffer.offerType,
                  discountValue: bestOffer.discountValue || 0,
                  bonusThreshold: bestOffer.bonusThreshold || 0,
                  bonusPoints: bestOffer.bonusPoints,
                  discountSteps: bestOffer.discountSteps,
                  followupValidityDays: bestOffer.followupValidityDays,
                  triggerItem: bestOffer.triggerItem,
                  triggerItemSize: bestOffer.triggerItemSize,
                  giftItemSize: bestOffer.giftItemSize,
                  targetCategory: bestOffer.targetCategory || null,
                  targetMenuItem: bestOffer.targetMenuItem || null,
                  freeItem: bestOffer.freeItem || null,
                  freeItems: bestOffer.freeItems || [],
                  validityHours: bestOffer.validityHours,
                  notificationTitle: bestOffer.notificationTitle,
                  notificationBody: bestOffer.notificationBody,
                }
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[BanditOptimizationService] Error:", err);
    }
  }
}

module.exports = BanditOptimizationService;
