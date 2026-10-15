const test = require("node:test");
const assert = require("node:assert/strict");
const RuleEvaluatorService = require("../services/smartOffersV2/RuleEvaluatorService");

const ratioRule = (operator, value) => ({
  logicalExpression: "C1",
  conditions: [{ conditionId: "C1", criteria: "recency_to_cadence_ratio", operator, value }],
});

test("une valeur décimale avec virgule est comparée comme un nombre", () => {
  assert.equal(RuleEvaluatorService.evaluate({ recencyToCadenceRatio: 1.1 }, ratioRule("<=", "1,25")), true);
  assert.equal(RuleEvaluatorService.evaluate({ recencyToCadenceRatio: 1.3 }, ratioRule("<=", "1,25")), false);
  assert.equal(RuleEvaluatorService.evaluate({ recencyToCadenceRatio: 1.3 }, ratioRule(">", "1,25")), true);
});

test("les valeurs avec point, entières ou numériques restent inchangées", () => {
  assert.equal(RuleEvaluatorService.evaluate({ recencyToCadenceRatio: 1.3 }, ratioRule(">", "1.25")), true);
  assert.equal(RuleEvaluatorService.evaluate({ recencyToCadenceRatio: 2.5 }, ratioRule(">", "2")), true);
  assert.equal(RuleEvaluatorService.evaluate({ recencyToCadenceRatio: 2 }, ratioRule("<=", 2)), true);
});
