// Création d'une livraison Uber Direct : pourboire du livreur envoyé et enregistré sur la commande.
// Uber et la base sont simulés (aucun appel réseau, aucune écriture).
const test = require("node:test");
const assert = require("node:assert/strict");

const calls = [];
let refuseTip = false;
let confirmedTip; // pourboire renvoyé par Uber (cents) ; par défaut, celui demandé
const requestPath = require.resolve("../services/uberDirectServices/uberDirectRequest");
require.cache[requestPath] = {
  id: requestPath, filename: requestPath, loaded: true,
  exports: {
    uberDirectRequest: async ({ path, body }) => {
      calls.push({ path, body });
      if (path.endsWith("/delivery_quotes")) return { status: 200, response: { id: "dqt_test" } };
      if (refuseTip && body.tip) return { status: 400, error: "max_tip_exceeded", details: { code: "max_tip_exceeded", message: "Max tip exceeded." } };
      return { status: 200, response: { id: "del_test", status: "pending", tip: confirmedTip ?? body.tip ?? 0 } };
    },
  },
};

const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const { createUberDirectDeliveryForOrder } = require("../controllers/uberDirect");

const run = async ({ customerTip, courierTipConfig }) => {
  calls.length = 0;
  const order = {
    _id: "order1", restaurant: "resto1", tip: customerTip, sub_total: 30, code: "TEST",
    user: { name: "Client Test", phone_number: "+15145550123" },
    orderItems: [{ item: { name: "Pizza" } }], offers: [],
    address: "2005 Rue Françoise Lemoyne, Trois-Rivières",
    detailed_address: { street_address: "2005 Rue Françoise Lemoyne", city: "Trois-Rivières", state: "QC", postal_code: "G8V 0J1", country: "CA" },
    coords: { latitude: 46.399, longitude: -72.531 },
    save: async () => {},
  };
  const restaurant = {
    _id: "resto1", uberCustomerId: "cus_test", name: "Resto Test", phone_number: "819-371-3935",
    address: "3331 Rue des Prairies, Trois-Rivières, QC", location: { latitude: 46.414, longitude: -72.53 },
    settings: { uber_courier_tip: courierTipConfig },
  };
  Order.findById = () => { const chain = { populate: () => chain, then: (ok, ko) => Promise.resolve(order).then(ok, ko) }; return chain; };
  Restaurant.findById = () => ({ select: async () => restaurant });
  const result = await createUberDirectDeliveryForOrder({ orderId: "order1", restaurantId: "resto1" });
  return { result, order, deliveryCalls: calls.filter((c) => c.path.endsWith("/deliveries")) };
};

const percent80 = { with_customer_tip: { mode: "percent", value: 80 }, without_customer_tip_amount: 2 };

test("pourboire client de 5 $ et 80 % → 4 $ envoyés à Uber (400 cents) et enregistrés", async () => {
  const { result, order, deliveryCalls } = await run({ customerTip: 5, courierTipConfig: percent80 });
  assert.equal(result.success, true);
  assert.equal(deliveryCalls.length, 1);
  assert.equal(deliveryCalls[0].body.tip, 400);
  assert.equal(order.uber_courier_tip, 4);
});

test("pas de pourboire client → montant fixe du restaurant (2 $)", async () => {
  const { deliveryCalls, order } = await run({ customerTip: 0, courierTipConfig: percent80 });
  assert.equal(deliveryCalls[0].body.tip, 200);
  assert.equal(order.uber_courier_tip, 2);
});

test("Uber refuse le pourboire → la livraison est créée quand même, sans pourboire", async () => {
  refuseTip = true;
  const { result, order, deliveryCalls } = await run({ customerTip: 5, courierTipConfig: percent80 });
  refuseTip = false;
  assert.equal(result.success, true);
  assert.equal(deliveryCalls.length, 2);
  assert.equal(deliveryCalls[1].body.tip, undefined);
  assert.equal(order.uber_courier_tip, 0);
});

test("le montant enregistré est celui confirmé par Uber", async () => {
  confirmedTip = 350;
  const { order, deliveryCalls } = await run({ customerTip: 5, courierTipConfig: percent80 });
  confirmedTip = undefined;
  assert.equal(deliveryCalls[0].body.tip, 400);
  assert.equal(order.uber_courier_tip, 3.5);
});

test("commande sous le seuil du restaurant → aucun pourboire envoyé", async () => {
  const { deliveryCalls, order } = await run({ customerTip: 5, courierTipConfig: { ...percent80, min_order_amount: 40 } });
  assert.equal("tip" in deliveryCalls[0].body, false);
  assert.equal(order.uber_courier_tip, 0);
});

test("restaurant non configuré → aucun pourboire envoyé", async () => {
  const { deliveryCalls, order } = await run({ customerTip: 5, courierTipConfig: undefined });
  assert.equal("tip" in deliveryCalls[0].body, false);
  assert.equal(order.uber_courier_tip, 0);
});
