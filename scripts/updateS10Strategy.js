require("dotenv").config();
const mongoose = require("mongoose");

const S10_CONFIGURATION = {
  name: "Récupérer les nouveaux clients en abandon prolongé",
  offerType: "bonus_basket",
  discountValue: 6,
  bonusThreshold: 25,
  bonusPoints: 0,
  targetCategory: null,
  targetMenuItem: null,
  freeItem: null,
  freeItems: [],
  triggerItem: null,
  triggerItemSize: "",
  giftItemSize: "",
  notificationTitle: "👋 On aimerait te revoir : 6$ pour reprendre l'habitude.",
  notificationBody: "Profite de 6$ de rabais sur ta prochaine commande dès 25$.",
};

const run = async () => {
  const uri = process.env.DEV_DB_CONNECTION;
  if (!uri) throw new Error("DEV_DB_CONNECTION is required.");

  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    const now = new Date();
    const rules = connection.collection("smartofferrules");
    const offers = connection.collection("personalizedoffers");
    const orders = connection.collection("orders");

    const existingRule = await rules.findOne({ strategyId: 10 });
    if (!existingRule) throw new Error("S10 does not exist.");
    const s9Rule = await rules.findOne({ strategyId: 9 });
    if (!s9Rule) throw new Error("S09 does not exist.");

    const openStatuses = ["prepared", "active", "viewed", "clicked"];
    const openS10Offers = await offers.find({
      strategyId: 10,
      status: { $in: openStatuses },
    }).toArray();
    const affectedUserIds = new Set(openS10Offers.map((offer) => String(offer.user)));
    const allOrders = await orders.find({}).project({
      user: 1,
      createdAt: 1,
      status: 1,
    }).toArray();
    const ordersByUser = new Map();
    for (const order of allOrders) {
      const userId = String(order.user || "");
      if (
        !affectedUserIds.has(userId) ||
        ["Annulé", "cancelled"].includes(order.status)
      ) continue;
      if (!ordersByUser.has(userId)) ordersByUser.set(userId, []);
      ordersByUser.get(userId).push(order);
    }

    const allS9Offers = await offers.find({
      strategyId: 9,
      user: { $in: openS10Offers.map((offer) => offer.user) },
    }).toArray();
    const s9OffersByUser = new Map();
    for (const offer of allS9Offers) {
      const userId = String(offer.user);
      if (!s9OffersByUser.has(userId)) s9OffersByUser.set(userId, []);
      s9OffersByUser.get(userId).push(offer);
    }

    const eligibleOfferIds = [];
    const ineligibleOfferIds = [];
    for (const offer of openS10Offers) {
      const userId = String(offer.user);
      const evaluationDate = new Date(offer.validFrom || offer.createdAt);
      const priorOrderCount = (ordersByUser.get(userId) || []).filter(
        (order) => new Date(order.createdAt) < evaluationDate,
      ).length;

      const priorS9Offers = (s9OffersByUser.get(userId) || [])
        .filter((s9Offer) => new Date(s9Offer.createdAt) < evaluationDate)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const lastS9 = priorS9Offers[0];
      let s9CooldownPassed = true;
      if (lastS9) {
        const cooldownStartedAt = lastS9.status === "applied"
          ? lastS9.updatedAt
          : lastS9.validUntil;
        s9CooldownPassed = Boolean(cooldownStartedAt) &&
          (evaluationDate - new Date(cooldownStartedAt)) / 86400000 >= s9Rule.cooldownDays;
      }

      const target = priorOrderCount >= 1 && priorOrderCount <= 2 && s9CooldownPassed
        ? eligibleOfferIds
        : ineligibleOfferIds;
      target.push(offer._id);
    }

    const ruleResult = await rules.updateOne(
      { strategyId: 10 },
      {
        $set: { ...S10_CONFIGURATION, updatedAt: now },
        $unset: { discountSteps: "" },
      },
    );

    const offerResult = await offers.updateMany(
      {
        _id: { $in: eligibleOfferIds },
      },
      {
        $set: { ...S10_CONFIGURATION, updatedAt: now },
        $unset: { discountSteps: "" },
      },
    );

    const expiredResult = await offers.updateMany(
      { _id: { $in: ineligibleOfferIds } },
      {
        $set: {
          status: "expired",
          validUntil: now,
          updatedAt: now,
        },
      },
    );

    console.log(JSON.stringify({
      ruleMatched: ruleResult.matchedCount,
      ruleModified: ruleResult.modifiedCount,
      openOffersMatched: offerResult.matchedCount,
      openOffersModified: offerResult.modifiedCount,
      ineligibleOffersExpired: expiredResult.modifiedCount,
    }));
  } finally {
    await connection.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
