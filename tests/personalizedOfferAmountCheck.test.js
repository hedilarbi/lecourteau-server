const test = require("node:test");
const assert = require("node:assert/strict");
const { checkPersonalizedOfferAmount } = require("../utils/personalizedOfferAmountCheck");

const base = {
  subTotal: 40,
  offerReplacesOtherDiscounts: true,
  firstOrderDiscountEligible: false,
  subscriptionDiscountAvailable: false,
  subscriptionDiscountPercent: 10,
  promoCodeRequested: false,
};

test("montant de l'offre exact (ou à 1 ¢ près) → commande avec l'offre", () => {
  const check = (received) =>
    checkPersonalizedOfferAmount({ ...base, offerType: "discount_order", offerApplied: true,
      expectedSubTotalWithOffer: 36, receivedSubTotalAfterDiscount: received }).result;
  assert.equal(check(36), "offer");
  assert.equal(check(35.99), "offer");
  assert.equal(check(36.01), "offer");
  assert.equal(check(36.02), "mismatch");
});

test("bug -20 % 1re commande + offre sans effet : le client paie avec ses 20 % → commande acceptée sans l'offre", () => {
  const check = checkPersonalizedOfferAmount({ ...base, firstOrderDiscountEligible: true,
    offerType: "discount_category", offerApplied: false,
    expectedSubTotalWithOffer: 40, receivedSubTotalAfterDiscount: 32 });
  assert.equal(check.result, "regular_discounts");
  assert.equal(check.regularFirstOrderDiscount, true);
  assert.equal(check.regularDiscountAmount, 8);
});

test("l'app applique les 20 % au lieu d'un rabais sur le sous-total → accepté sans l'offre", () => {
  const check = checkPersonalizedOfferAmount({ ...base, firstOrderDiscountEligible: true,
    offerType: "discount_order", offerApplied: true,
    expectedSubTotalWithOffer: 34, receivedSubTotalAfterDiscount: 32 });
  assert.equal(check.result, "regular_discounts");
});

test("abonné : rabais abonnement au lieu de l'offre → accepté sans l'offre", () => {
  const check = checkPersonalizedOfferAmount({ ...base, subscriptionDiscountAvailable: true,
    offerType: "discount_product", offerApplied: false,
    expectedSubTotalWithOffer: 40, receivedSubTotalAfterDiscount: 36 });
  assert.equal(check.result, "regular_discounts");
  assert.equal(check.regularSubscriptionPercent, 10);
});

test("cumul interdit : article offert / livraison gratuite + 20 % → refus", () => {
  for (const offerType of ["free_item", "free_delivery", "buy_one_get_one", "loyalty_points", "mystery_gift"]) {
    const check = checkPersonalizedOfferAmount({ ...base, firstOrderDiscountEligible: true,
      offerType, offerApplied: true, expectedSubTotalWithOffer: 40, receivedSubTotalAfterDiscount: 32 });
    assert.equal(check.result, "mismatch", offerType);
  }
});

test("montant qui ne correspond à rien → refus", () => {
  const check = checkPersonalizedOfferAmount({ ...base, firstOrderDiscountEligible: true,
    offerType: "discount_order", offerApplied: true,
    expectedSubTotalWithOffer: 34, receivedSubTotalAfterDiscount: 20 });
  assert.equal(check.result, "mismatch");
});

test("cashback (ne remplace pas les remises) : jamais de repli", () => {
  const check = checkPersonalizedOfferAmount({ ...base, offerReplacesOtherDiscounts: false,
    firstOrderDiscountEligible: true, offerType: "deferred_cashback", offerApplied: true,
    expectedSubTotalWithOffer: 32, receivedSubTotalAfterDiscount: 32 });
  assert.equal(check.result, "offer");
});
