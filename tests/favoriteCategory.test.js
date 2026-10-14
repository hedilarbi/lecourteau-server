const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isExcludedFavoriteCategoryName,
  getExcludedFavoriteCategoryIds,
  pickFavoriteCategoryId,
} = require("../utils/favoriteCategory");
const RuleEvaluatorService = require("../services/smartOffersV2/RuleEvaluatorService");

const categories = [
  { _id: "promos", name: "PROMOS" },
  { _id: "poutines", name: "POUTINES SIGNATURES" },
  { _id: "pizzas", name: "PIZZAS" },
];

test("seule la catégorie PROMOS est exclue (casse, espaces et accents ignorés)", () => {
  assert.equal(isExcludedFavoriteCategoryName("PROMOS"), true);
  assert.equal(isExcludedFavoriteCategoryName(" Promos "), true);
  assert.equal(isExcludedFavoriteCategoryName("Promotions"), true);
  assert.equal(isExcludedFavoriteCategoryName("POUTINES SIGNATURES"), false);
  assert.deepEqual([...getExcludedFavoriteCategoryIds(categories)], ["promos"]);
});

test("favorite = PROMOS → la catégorie qui vient ensuite", () => {
  const counts = new Map([["promos", 12], ["pizzas", 2], ["poutines", 5]]);
  assert.equal(pickFavoriteCategoryId(counts, new Set(["promos"])), "poutines");
});

test("client qui n'achète que des PROMOS → pas de catégorie favorite", () => {
  assert.equal(pickFavoriteCategoryId({ promos: 8 }, new Set(["promos"])), null);
});

test("à égalité, la première catégorie rencontrée gagne (comme avant)", () => {
  assert.equal(pickFavoriteCategoryId({ pizzas: 3, poutines: 3 }, new Set()), "pizzas");
});

test("critère « catégorie favorite » des règles : vraie favorite, PROMOS comprise", () => {
  const line = (category) => ({ item: { _id: `item-${category}`, category } });
  const orders = [
    { createdAt: new Date(), orderItems: [line("promos"), line("promos"), line("poutines")] },
    { createdAt: new Date(), orderItems: [line("promos")] },
  ];
  const rule = { conditions: [{ conditionId: "C1", criteria: "favorite_category", operator: "==", value: "poutines" }] };
  assert.equal(RuleEvaluatorService.evaluate({ orders }, rule), false);
  assert.equal(RuleEvaluatorService.evaluate({ orders }, { conditions: [{ ...rule.conditions[0], value: "promos" }] }), true);
});
