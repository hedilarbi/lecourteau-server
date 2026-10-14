const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.SECRET_KEY = process.env.SECRET_KEY || "smart-client-test-secret";

const SmartClientRule = require("../modules/smart-client/smartClient.model");
const { authClient } = require("../modules/smart-client/smartClientAuth.middleware");

const USER_ID = "507f1f77bcf86cd799439011";
const validRule = () => ({
  track: "Persuasion",
  ruleName: "Test sensible au prix",
  triggerEvent: "state_change",
  selectedStates: ["Sensible au prix"],
  conditions: { operator: "AND", cart: { minTotal: 10 } },
  offer: { mechanic: "fixed_price", valueType: "fixed_price", value: 2 },
  location: "checkout",
  safeguards: { triggerRate: 50, controlGroupPct: 10 },
});

test("validates a complete Smart Client rule", async () => {
  const rule = new SmartClientRule(validRule());
  await rule.validate();
  assert.equal(rule.schemaVersion, 2);
  assert.equal(rule.version, 1);
});

test("rejects invalid percentages and unknown mechanics", async () => {
  const data = validRule();
  data.offer.mechanic = "unknown";
  data.safeguards.triggerRate = 120;
  await assert.rejects(() => new SmartClientRule(data).validate(), /triggerRate|mechanic/i);
});

test("rejects an inverted validity window", async () => {
  const data = validRule();
  data.safeguards.startDate = "2026-10-10";
  data.safeguards.endDate = "2026-10-01";
  await assert.rejects(() => new SmartClientRule(data).validate(), /date de fin/i);
});

const invokeAuth = (authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  authClient(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
};

test("Smart Client mobile auth derives the user from the signed token", () => {
  const token = jwt.sign({ id: USER_ID }, process.env.SECRET_KEY);
  const result = invokeAuth(`Bearer ${token}`);
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.id, USER_ID);
});

test("Smart Client mobile auth rejects missing tokens", () => {
  const result = invokeAuth();
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});
