const { recalculateCooldownAfterOrder } = require("./OfferCooldownService");

/**
 * Déclenché à la confirmation d'une commande (confirmOrderService), une fois les statuts
 * d'offres mis à jour (applied / ignored) :
 *   1. recalcule le cooldown si la commande a utilisé ou ignoré une offre
 *      (date de confirmation + cooldown de l'offre, voir OfferCooldownService) ;
 *   2. ré-évalue le client avec EXACTEMENT les règles du scan de nuit (prepareDailyOffersJob
 *      limité à ce client) : éligibilité, scénarios, offre déjà en cours, cooldown, programmation.
 *      Tant que le client est en cooldown, aucune nouvelle offre n'est créée — le scan de nuit
 *      prendra le relais à la fin du délai (étape suivante d'un scénario comprise).
 * Ne lève jamais d'erreur : la confirmation de commande ne doit pas en dépendre.
 */
async function evaluateUserSmartOffers(order) {
  const userId = order?.user?._id || order?.user;
  if (!userId) return;
  try {
    await recalculateCooldownAfterOrder(order, new Date());
  } catch (error) {
    console.error(`[postOrderSmartOffers] Recalcul du cooldown (commande ${order?._id}) :`, error.message);
  }

  try {
    // require tardif : ProfilingService charge de nombreux modèles et services.
    const { prepareDailyOffersJob } = require("./ProfilingService");
    await prepareDailyOffersJob(false, { userIds: [userId], reconsiderPrepared: true });
  } catch (error) {
    console.error(`[postOrderSmartOffers] Ré-évaluation du client ${userId} :`, error.message);
  }
}

module.exports = {
  evaluateUserSmartOffers,
};
