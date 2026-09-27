const test = require("node:test");
const assert = require("node:assert/strict");

const { selectDiscountOrderAmount } = require("../utils/discountOrderAmount");

test("accepts the mobile full-basket discount", () => {
  assert.deepEqual(
    selectDiscountOrderAmount({
      discountPercent: 35,
      orderSubtotal: 30,
      receivedSubtotalAfterDiscount: 19.5,
      eligibleItemsSubtotal: 20,
      fullBasketSubtotal: 30,
    }),
    { mode: "full_basket", amount: 10.5 },
  );
});

test("keeps compatibility with the web eligible-items discount", () => {
  assert.deepEqual(
    selectDiscountOrderAmount({
      discountPercent: 35,
      orderSubtotal: 30,
      receivedSubtotalAfterDiscount: 23,
      eligibleItemsSubtotal: 20,
      fullBasketSubtotal: 30,
    }),
    { mode: "eligible_items", amount: 7 },
  );
});

test("matches the JavaScript currency rounding used by checkout", () => {
  assert.deepEqual(
    selectDiscountOrderAmount({
      discountPercent: 35,
      orderSubtotal: 48.5,
      receivedSubtotalAfterDiscount: 31.53,
      eligibleItemsSubtotal: 40,
      fullBasketSubtotal: 48.5,
    }),
    { mode: "full_basket", amount: 16.97 },
  );
});

test("does not accept an arbitrary client discount", () => {
  const selected = selectDiscountOrderAmount({
    discountPercent: 35,
    orderSubtotal: 30,
    receivedSubtotalAfterDiscount: 10,
    eligibleItemsSubtotal: 20,
    fullBasketSubtotal: 30,
  });

  assert.deepEqual(selected, { mode: "full_basket", amount: 10.5 });
  assert.notEqual(30 - selected.amount, 10);
});
