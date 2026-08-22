const PersonalizedOffer = require("../../models/PersonalizedOffer");

/**
 * Rend son étape à un rabais divisé lorsqu'une commande est annulée.
 *
 * createOrderService incrémente `currentStep` dès la CRÉATION de la commande,
 * donc avant l'encaissement. Sans cette restauration, une commande annulée
 * (paiement refusé, PaymentIntent annulé, annulation par le restaurant)
 * consomme définitivement une étape que le client n'a jamais utilisée : il perd
 * un rabais sans contrepartie et sans explication.
 *
 * Volontairement, ni `firstAppliedAt` ni `validUntil` ne sont touchés. La
 * fenêtre de validité reste ancrée sur la première utilisation, même annulée :
 * la réinitialiser permettrait de prolonger indéfiniment une offre en
 * enchaînant création puis annulation de commandes.
 */
const restoreSplitDiscountStepOnCancel = async (order) => {
  const offerId = order?.personalizedOffer;
  if (!offerId) return;

  const usedStep = Number(order?.smartOfferUsageStep);
  if (!Number.isInteger(usedStep) || usedStep < 0) return;

  const offer = await PersonalizedOffer.findById(offerId).select(
    "offerType currentStep status",
  );
  if (!offer || offer.offerType !== "split_discount") return;

  // Le compteur ne doit jamais remonter : si une commande plus récente a déjà
  // consommé une étape supérieure, l'état courant fait foi.
  if (Number(offer.currentStep) <= usedStep) return;

  const update = { currentStep: usedStep };

  // "applied" signifie que cette commande avait épuisé la dernière étape :
  // l'offre redevient utilisable. Tout autre statut ("expired" posé par la
  // règle R15, par exemple) résulte d'une décision distincte qu'on ne doit pas
  // annuler ici.
  if (offer.status === "applied") {
    update.status = "active";
  }

  await PersonalizedOffer.findByIdAndUpdate(offerId, { $set: update });
};

module.exports = { restoreSplitDiscountStepOnCancel };
