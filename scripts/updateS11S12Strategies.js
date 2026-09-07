require("dotenv").config();
const mongoose = require("mongoose");

const CONFIGURATIONS = new Map([
  [11, {
    name: "Récupérer les nouveaux clients en abandon ancien",
    offerType: "bonus_basket",
    discountValue: 6,
    bonusThreshold: 25,
    notificationTitle: "😋 Ça fait longtemps : 6$ pour redonner une chance à Courteau.",
    notificationBody: "Profite de 6$ de rabais sur ta prochaine commande dès 25$.",
  }],
  [12, {
    name: "Dernière tentative de récupération des nouveaux clients",
    offerType: "bonus_basket",
    discountValue: 8,
    bonusThreshold: 30,
    cooldownDays: 9999,
    notificationTitle: "💥 Une dernière invitation : 8$ pour revenir chez Courteau.",
    notificationBody: "Profite de 8$ de rabais sur ta prochaine commande dès 30$ d'achat.",
  }],
]);

const OPEN_STATUSES = ["prepared", "active", "viewed", "clicked"];

const run = async () => {
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION is required.");

  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    const now = new Date();
    const rules = connection.collection("smartofferrules");
    const offers = connection.collection("personalizedoffers");
    const orders = connection.collection("orders");
    const ruleDocs = await rules.find({ strategyId: { $in: [10, 11, 12] } }).toArray();
    const ruleById = new Map(ruleDocs.map((rule) => [rule.strategyId, rule]));
    if (![10, 11, 12].every((strategyId) => ruleById.has(strategyId))) {
      throw new Error("S10, S11 and S12 must exist before this migration.");
    }

    const openOffers = await offers.find({
      strategyId: { $in: [11, 12] },
      status: { $in: OPEN_STATUSES },
    }).toArray();
    const affectedUserIds = new Set(openOffers.map((offer) => String(offer.user)));
    const allOrders = await orders.find({}).project({ user: 1, createdAt: 1, status: 1 }).toArray();
    const ordersByUser = new Map();
    for (const order of allOrders) {
      const userId = String(order.user || "");
      if (!affectedUserIds.has(userId) || ["Annulé", "cancelled"].includes(order.status)) continue;
      if (!ordersByUser.has(userId)) ordersByUser.set(userId, []);
      ordersByUser.get(userId).push(order);
    }

    const predecessorOffers = await offers.find({
      strategyId: { $in: [10, 11] },
      user: { $in: openOffers.map((offer) => offer.user) },
    }).toArray();
    const predecessorByUserAndStrategy = new Map();
    for (const offer of predecessorOffers) {
      const key = `${offer.user}:${offer.strategyId}`;
      if (!predecessorByUserAndStrategy.has(key)) predecessorByUserAndStrategy.set(key, []);
      predecessorByUserAndStrategy.get(key).push(offer);
    }

    const eligibility = new Map([[11, []], [12, []]]);
    const ineligibleIds = [];
    for (const offer of openOffers) {
      const evaluationDate = new Date(offer.validFrom || offer.createdAt);
      const userId = String(offer.user);
      const priorOrderCount = (ordersByUser.get(userId) || []).filter(
        (order) => new Date(order.createdAt) < evaluationDate,
      ).length;
      const predecessorId = offer.strategyId - 1;
      const predecessorRule = ruleById.get(predecessorId);
      const priorPredecessorOffers = (predecessorByUserAndStrategy.get(`${userId}:${predecessorId}`) || [])
        .filter((candidate) => new Date(candidate.createdAt) < evaluationDate)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const predecessor = priorPredecessorOffers[0];
      let predecessorCooldownPassed = true;
      if (predecessor) {
        const cooldownStartedAt = predecessor.status === "applied"
          ? predecessor.updatedAt
          : predecessor.validUntil;
        predecessorCooldownPassed = Boolean(cooldownStartedAt) &&
          (evaluationDate - new Date(cooldownStartedAt)) / 86400000 >= predecessorRule.cooldownDays;
      }

      if (priorOrderCount >= 1 && priorOrderCount <= 2 && predecessorCooldownPassed) {
        eligibility.get(offer.strategyId).push(offer._id);
      } else {
        ineligibleIds.push(offer._id);
      }
    }

    const results = {};
    for (const [strategyId, configuration] of CONFIGURATIONS) {
      const normalized = {
        ...configuration,
        bonusPoints: 0,
        targetCategory: null,
        targetMenuItem: null,
        freeItem: null,
        freeItems: [],
        triggerItem: null,
        triggerItemSize: "",
        giftItemSize: "",
      };
      const ruleResult = await rules.updateOne(
        { strategyId },
        { $set: { ...normalized, updatedAt: now }, $unset: { discountSteps: "" } },
      );
      const offerResult = await offers.updateMany(
        { _id: { $in: eligibility.get(strategyId) } },
        { $set: { ...normalized, updatedAt: now }, $unset: { discountSteps: "" } },
      );
      results[strategyId] = {
        ruleModified: ruleResult.modifiedCount,
        eligibleOpenOffersUpdated: offerResult.modifiedCount,
      };
    }

    const expiredResult = await offers.updateMany(
      { _id: { $in: ineligibleIds } },
      { $set: { status: "expired", validUntil: now, updatedAt: now } },
    );
    console.log(JSON.stringify({ ...results, ineligibleOpenOffersExpired: expiredResult.modifiedCount }));
  } finally {
    await connection.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
