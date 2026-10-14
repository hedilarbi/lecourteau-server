const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(toSafeNumber(value, 0) * 100) / 100;
const toCents = (value) => Math.round(roundMoney(value) * 100);

/**
 * Rabais "discount_order" (et récompense de cashback) : pourcentage appliqué aux seuls articles
 * remisables — jamais aux offres du panier (combos), aux catégories exclues de l'offre ni aux
 * articles verrouillés promo. Même règle que le rabais divisé et les paliers.
 */
const selectDiscountOrderAmount = ({
  discountPercent,
  orderSubtotal,
  receivedSubtotalAfterDiscount,
  eligibleItemsSubtotal,
}) => {
  const percent = toSafeNumber(discountPercent, 0) / 100;
  const subtotal = roundMoney(orderSubtotal);
  const received = roundMoney(receivedSubtotalAfterDiscount);
  const amount = roundMoney(toSafeNumber(eligibleItemsSubtotal, 0) * percent);
  const expected = roundMoney(Math.max(0, subtotal - amount));

  if (Math.abs(toCents(expected) - toCents(received)) <= 1) {
    // Écart d'un centime toléré (cumul de flottants côté app) : on garde le montant du
    // checkout pour que la validation finale tombe exactement sur la même valeur.
    return { mode: "eligible_items", amount: roundMoney(Math.max(0, subtotal - received)) };
  }
  return { mode: "eligible_items", amount };
};

module.exports = { selectDiscountOrderAmount };
