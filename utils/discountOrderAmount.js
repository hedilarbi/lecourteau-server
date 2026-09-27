const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(toSafeNumber(value, 0) * 100) / 100;

const selectDiscountOrderAmount = ({
  discountPercent,
  orderSubtotal,
  receivedSubtotalAfterDiscount,
  eligibleItemsSubtotal,
  fullBasketSubtotal,
}) => {
  const percent = toSafeNumber(discountPercent, 0) / 100;
  const subtotal = roundMoney(orderSubtotal);
  const received = roundMoney(receivedSubtotalAfterDiscount);
  const candidates = [
    {
      mode: "full_basket",
      amount: roundMoney(toSafeNumber(fullBasketSubtotal, 0) * percent),
    },
    {
      mode: "eligible_items",
      amount: roundMoney(toSafeNumber(eligibleItemsSubtotal, 0) * percent),
    },
  ];

  const matchingCandidate = candidates.find(({ amount }) => {
    const expected = roundMoney(Math.max(0, subtotal - amount));
    return Math.abs(expected - received) <= 0.01;
  });

  // The mobile app applies discount_order to the complete basket. Keep that
  // as the canonical calculation, while accepting the existing web client's
  // eligible-items calculation during the compatibility period.
  return matchingCandidate || candidates[0];
};

module.exports = { selectDiscountOrderAmount };
