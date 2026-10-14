const test = require("node:test");
const assert = require("node:assert");
const PersonalizedOffer = require("../models/PersonalizedOffer");
const { evaluateRule } = require("../services/smartOffersV2/BanditOptimizationService");
const OfferDistributionService = require("../services/smartOffersV2/OfferDistributionService");

const rule = {
  _id: "rule",
  offers: [
    { _id: "a", offerType: "discount_order" },
    { _id: "b", offerType: "free_item" },
  ],
};

const withCounts = async (rows, fn) => {
  const original = PersonalizedOffer.aggregate;
  PersonalizedOffer.aggregate = async () => rows;
  try {
    return await fn();
  } finally {
    PersonalizedOffer.aggregate = original;
  }
};

test("désigne la version au meilleur taux quand chacune a assez de résultats", async () => {
  const evaluation = await withCounts(
    [{ _id: "a", resolved: 40, used: 4 }, { _id: "b", resolved: 25, used: 5 }],
    () => evaluateRule(rule),
  );
  assert.strictEqual(String(evaluation.winnerOfferConfigId), "b");
  assert.deepStrictEqual(evaluation.stats.map((s) => s.rate), [10, 20]);
});

test("aucune gagnante tant qu'une version a moins de 20 résultats", async () => {
  const evaluation = await withCounts(
    [{ _id: "a", resolved: 40, used: 30 }, { _id: "b", resolved: 19, used: 0 }],
    () => evaluateRule(rule),
  );
  assert.strictEqual(evaluation.winnerOfferConfigId, null);
});

test("le scan donne la gagnante environ 85 % du temps", () => {
  const withWinner = { ...rule, banditEvaluation: { winnerOfferConfigId: "b" } };
  let winnerCount = 0;
  for (let i = 0; i < 20000; i += 1) {
    if (OfferDistributionService.handleMultiArmedBandit(withWinner)._id === "b") winnerCount += 1;
  }
  assert.ok(winnerCount / 20000 > 0.83 && winnerCount / 20000 < 0.87);
});

test("sans gagnante (ou gagnante supprimée de la règle), tirage à parts égales", () => {
  const removedWinner = { ...rule, banditEvaluation: { winnerOfferConfigId: "zzz" } };
  let aCount = 0;
  for (let i = 0; i < 20000; i += 1) {
    if (OfferDistributionService.handleMultiArmedBandit(removedWinner)._id === "a") aCount += 1;
  }
  assert.ok(aCount / 20000 > 0.47 && aCount / 20000 < 0.53);
});
