const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(toSafeNumber(value, 0) * 100) / 100;
const toCents = (value) => Math.round(roundMoney(value) * 100);

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
    return Math.abs(toCents(expected) - toCents(received)) <= 1;
  });

  // The mobile app applies discount_order to the complete basket. Keep that
  // as the canonical calculation, while accepting the existing web client's
  // eligible-items calculation during the compatibility period.
  if (!matchingCandidate) return candidates[0];

  return {
    mode: matchingCandidate.mode,
    // The checkout subtotal can differ by one cent because React Native
    // accumulates prices as floating-point values before rounding. Once the
    // server has verified that it matches a valid calculation within one
    // cent, retain the effective checkout discount so the final validation
    // uses the exact same cent value.
    amount: roundMoney(Math.max(0, subtotal - received)),
  };
};

module.exports = { selectDiscountOrderAmount };
