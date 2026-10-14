const test = require("node:test");
const assert = require("node:assert/strict");

const { selectDiscountOrderAmount } = require("../utils/discountOrderAmount");

test("applies the discount to eligible items only (basket offers excluded)", () => {
  assert.deepEqual(
    selectDiscountOrderAmount({
      discountPercent: 35,
      orderSubtotal: 30,
      receivedSubtotalAfterDiscount: 23,
      eligibleItemsSubtotal: 20,
    }),
    { mode: "eligible_items", amount: 7 },
  );
});

test("never discounts the full basket when it includes offers", () => {
  const selected = selectDiscountOrderAmount({
    discountPercent: 35,
    orderSubtotal: 30,
    receivedSubtotalAfterDiscount: 19.5, // 35 % du panier complet, offres comprises
    eligibleItemsSubtotal: 20,
  });
  assert.deepEqual(selected, { mode: "eligible_items", amount: 7 });
  assert.notEqual(roundCents(30 - selected.amount), 19.5);
});

test("accepts a one-cent floating-point difference", () => {
  assert.deepEqual(
    selectDiscountOrderAmount({
      discountPercent: 35,
      orderSubtotal: 48.5,
      receivedSubtotalAfterDiscount: 34.51,
      eligibleItemsSubtotal: 40,
    }),
    { mode: "eligible_items", amount: 13.99 },
  );
});

test("does not accept an arbitrary client discount", () => {
  const selected = selectDiscountOrderAmount({
    discountPercent: 35,
    orderSubtotal: 30,
    receivedSubtotalAfterDiscount: 10,
    eligibleItemsSubtotal: 20,
  });
  assert.deepEqual(selected, { mode: "eligible_items", amount: 7 });
});

function roundCents(value) {
  return Math.round(value * 100) / 100;
}
