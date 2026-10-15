const test = require("node:test");
const assert = require("node:assert/strict");
const { getOfferTextValues, personalizeOfferText } = require("../utils/offerNotificationText");

const menu = new Map([["burger", "Burger double"], ["poutine", "Poutine Buffalo"]]);
const fill = (offer, text, extra = {}) =>
  personalizeOfferText(text, { name: "Marie Tremblay" }, getOfferTextValues(offer, { menuItemsById: menu, ...extra }));

test("{name} : nom du client, « cher client » sans nom", () => {
  assert.equal(fill({ offerType: "discount_order", discountValue: 20 }, "{name}, {discount} pour toi"), "Marie Tremblay, 20 % pour toi");
  assert.equal(personalizeOfferText("Salut {name}", {}, {}), "Salut cher client");
});

test("cashback : seuil et % de la récompense (plus de « 30 » par défaut)", () => {
  const offer = { offerType: "deferred_cashback", bonusThreshold: 0, deferredThreshold: 25, deferredDiscountValue: 20 };
  assert.equal(fill(offer, "Dès {threshold} $ aujourd'hui, {discount} mardi"), "Dès 25 $ aujourd'hui, 20 % mardi");
});

test("{item} : produit remisé, article offert, cadeau du 1 acheté = 1 offert", () => {
  assert.equal(fill({ offerType: "discount_product", discountValue: 25, targetMenuItem: "burger" }, "{discount} sur ton {item}"), "25 % sur ton Burger double");
  assert.equal(fill({ offerType: "free_item", bonusThreshold: 30, freeItems: [{ item: "poutine" }] }, "{item} offerte dès {threshold} $"), "Poutine Buffalo offerte dès 30 $");
  assert.equal(fill({ offerType: "buy_one_get_one", triggerItem: "burger", freeItem: "burger" }, "1 {item} acheté = 1 offert"), "1 Burger double acheté = 1 offert");
  assert.equal(fill({ offerType: "mystery_gift", mysteryThreshold: 35 }, "Dès {threshold} $, {item} t'attend"), "Dès 35 $, un cadeau surprise t'attend");
});

test("paliers, rabais fixe, rabais en plusieurs fois, points, catégorie", () => {
  assert.equal(fill({ offerType: "tiered_discount", tieredDiscounts: [{ threshold: 25, discountValue: 10 }, { threshold: 40, discountValue: 20 }] }, "Jusqu'à {discount} dès {threshold} $"), "Jusqu'à 20 % dès 25 $");
  assert.equal(fill({ offerType: "bonus_basket", discountValue: 7, bonusThreshold: 32.5 }, "{discount} dès {threshold} $"), "7 $ dès 32,50 $");
  assert.equal(fill({ offerType: "split_discount", discountSteps: [25, 20, 20] }, "{discount} sur ta prochaine commande"), "25 % sur ta prochaine commande");
  assert.equal(fill({ offerType: "loyalty_points", bonusPoints: 300 }, "+{points} points"), "+300 points");
  assert.equal(fill({ offerType: "discount_category", discountValue: 20 }, "{discount} sur {category}", { categoryName: "POUTINES" }), "20 % sur POUTINES");
});

test("une variable sans valeur est retirée, jamais affichée telle quelle", () => {
  assert.equal(fill({ offerType: "discount_order", discountValue: 15 }, "{discount} sur {item} maintenant"), "15 % sur maintenant");
});
