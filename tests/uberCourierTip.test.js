const test = require("node:test");
const assert = require("node:assert/strict");
const { computeUberCourierTip, normalizeUberCourierTipConfig, getOrderAmountForCourierTip } = require("../utils/uberCourierTip");

const percent80 = { with_customer_tip: { mode: "percent", value: 80 }, without_customer_tip_amount: 2 };
const fixed3 = { with_customer_tip: { mode: "fixed", value: 3 }, without_customer_tip_amount: 2 };

test("pourboire du client de 1 $ ou plus : % du pourboire", () => {
  assert.equal(computeUberCourierTip(5, percent80), 4);
  assert.equal(computeUberCourierTip(2.274, percent80), 1.82); // 80 % de 2,27 $
});

test("exactement 1 $ : champ « avec pourboire »", () => {
  assert.equal(computeUberCourierTip(1, percent80), 0.8);
  assert.equal(computeUberCourierTip(1, fixed3), 3);
});

test("montant fixe : le restaurant paie la différence", () => {
  assert.equal(computeUberCourierTip(1.5, fixed3), 3);
  assert.equal(computeUberCourierTip(10, fixed3), 3);
});

test("pourboire du client sous 1 $ (y compris 0) : montant fixe dédié", () => {
  assert.equal(computeUberCourierTip(0.99, percent80), 2);
  assert.equal(computeUberCourierTip(0, fixed3), 2);
  assert.equal(computeUberCourierTip(undefined, fixed3), 2);
});

test("restaurant non configuré : aucun pourboire", () => {
  assert.equal(computeUberCourierTip(5, undefined), 0);
  assert.equal(computeUberCourierTip(0, {}), 0);
});

test("configuration nettoyée : valeurs négatives à 0, % plafonné à 100, mode inconnu → fixe", () => {
  assert.deepEqual(normalizeUberCourierTipConfig({ with_customer_tip: { mode: "percent", value: 150 }, without_customer_tip_amount: -3 }),
    { with_customer_tip: { mode: "percent", value: 100 }, without_customer_tip_amount: 0, min_order_amount: 0 });
  assert.equal(normalizeUberCourierTipConfig({ with_customer_tip: { mode: "autre", value: "4" } }).with_customer_tip.mode, "fixed");
});

test("commande sous le seuil du restaurant → aucun pourboire", () => {
  const config = { ...percent80, min_order_amount: 30 };
  assert.equal(computeUberCourierTip(5, config, 29.99), 0);
  assert.equal(computeUberCourierTip(0, config, 20), 0);
  assert.equal(computeUberCourierTip(5, config, 30), 4); // seuil atteint
  assert.equal(computeUberCourierTip(5, percent80, 10), 4); // pas de seuil configuré
});

test("montant comparé au seuil : sous-total après rabais", () => {
  assert.equal(getOrderAmountForCourierTip({ sub_total: 40, sub_total_after_discount: 32 }), 32);
  assert.equal(getOrderAmountForCourierTip({ sub_total: 40 }), 40);
});
