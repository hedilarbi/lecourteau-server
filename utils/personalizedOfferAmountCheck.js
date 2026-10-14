// Contrôle du sous-total après rabais envoyé par le checkout quand une offre personnalisée
// accompagne la commande. La commande n'est refusée que si le montant ne correspond à AUCUNE
// lecture légitime du panier.
const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const roundMoney = (value) => Math.round(toSafeNumber(value, 0) * 100) / 100;
// Centimes, 1 ¢ toléré : une comparaison de flottants (0,0100000001 > 0,01) refusait des
// commandes justes.
const toCents = (value) => Math.round(toSafeNumber(value, 0) * 100);
const matchesCents = (expected, received) => Math.abs(toCents(expected) - toCents(received)) <= 1;

// Offres dont le seul avantage est un rabais sur le sous-total.
const SUBTOTAL_ONLY_OFFER_TYPES = [
  "discount_order",
  "discount_category",
  "discount_product",
  "bonus_basket",
  "split_discount",
  "tiered_discount",
];

/**
 * @returns {{ result: "offer" | "regular_discounts" | "mismatch", regularFirstOrderDiscount: boolean,
 *   regularSubscriptionPercent: number, regularDiscountAmount: number }}
 *   - "offer" : le montant correspond à l'offre → commande avec l'offre.
 *   - "regular_discounts" : le checkout a appliqué les remises habituelles (1re commande /
 *     abonnement) au lieu de l'offre (offre sans effet sur ce panier, ou remise de l'offre non
 *     vue par l'app). Le client paie ce qu'il paierait sans l'offre → commande SANS l'offre.
 *     Jamais pour une offre qui a donné un avantage hors sous-total (article offert, livraison,
 *     points, cadeau) : il ne se cumule pas avec ces remises.
 *   - "mismatch" : aucune lecture ne correspond → refus.
 */
const checkPersonalizedOfferAmount = ({
  subTotal,
  receivedSubTotalAfterDiscount,
  expectedSubTotalWithOffer,
  offerType,
  offerApplied,
  offerReplacesOtherDiscounts,
  firstOrderDiscountEligible,
  subscriptionDiscountAvailable,
  subscriptionDiscountPercent,
  promoCodeRequested,
}) => {
  const regularFirstOrderDiscount = Boolean(firstOrderDiscountEligible) && !promoCodeRequested;
  const regularSubscriptionPercent =
    subscriptionDiscountAvailable && !regularFirstOrderDiscount && !promoCodeRequested
      ? toSafeNumber(subscriptionDiscountPercent, 0)
      : 0;
  const base = toSafeNumber(subTotal, 0);
  const regularDiscountAmount = regularFirstOrderDiscount
    ? roundMoney(base * 0.2)
    : roundMoney(base * (regularSubscriptionPercent / 100));
  const details = { regularFirstOrderDiscount, regularSubscriptionPercent, regularDiscountAmount };

  if (matchesCents(expectedSubTotalWithOffer, receivedSubTotalAfterDiscount)) {
    return { result: "offer", ...details };
  }
  const canFallBack =
    Boolean(offerReplacesOtherDiscounts) &&
    (!offerApplied || SUBTOTAL_ONLY_OFFER_TYPES.includes(offerType));
  if (canFallBack && matchesCents(base - regularDiscountAmount, receivedSubTotalAfterDiscount)) {
    return { result: "regular_discounts", ...details };
  }
  return { result: "mismatch", ...details };
};

module.exports = { checkPersonalizedOfferAmount };
