const mongoose = require("mongoose");
const cron = require("node-cron");
const { Expo } = require("expo-server-sdk");
const User = require("../models/User");
const Order = require("../models/Order");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const UserSmartProfile = require("../models/UserSmartProfile");
const SmartOfferRule = require("../models/SmartOfferRule");
const PersonalizedOffer = require("../models/PersonalizedOffer");
const PersonalizedOfferEvent = require("../models/PersonalizedOfferEvent");
const { sendSmartOfferUninstalledEmail } = require("../services/offersServices/smartOfferMailService");
const SystemStat = require("../models/SystemStat");

// In-memory store: { ticketId -> { offerId, userId } }
// Persisted across cron cycles within the same process instance
const pendingReceiptMap = {};

const DEFAULT_TIMEZONE = "America/Toronto";

// ─── Batch / concurrency settings ────────────────────────────────────────────
// prepareDailyOffersJob  → runs at midnight, no live traffic, larger batches OK
const PREPARE_BATCH_SIZE   = 100;   // users processed per batch
const PREPARE_BATCH_DELAY  = 200;   // ms pause between batches (let DB breathe)

// triggerScheduledOffersJob → runs every 5 min during peak hours, stay light
const TRIGGER_BATCH_SIZE   = 50;    // offers activated per tick
const TRIGGER_BATCH_DELAY  = 100;   // ms pause between batches

// bulkWrite limit for DB writes in a single round
const BULK_WRITE_SIZE = 50;

/** Sleep helper – throttle between batches */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── Pure helper functions (no DB calls) ─────────────────────────────────────

const personalizeText = (text, user, offerDetails = {}) => {
  if (!text) return "";
  const name = user.name ? user.name.trim() : "cher client";
  let result = text.replace(/{name}/g, name).replace(/{{name}}/g, name);

  if (offerDetails.categoryName) {
    result = result.replace(/{category}/g, offerDetails.categoryName);
  }
  if (offerDetails.itemName) {
    result = result.replace(/{item}/g, offerDetails.itemName);
  }
  if (offerDetails.discount) {
    result = result.replace(/{discount}/g, offerDetails.discount);
  }
  if (offerDetails.threshold !== undefined && offerDetails.threshold !== null && offerDetails.threshold !== "") {
    result = result.replace(/{threshold}/g, String(offerDetails.threshold));
  }
  result = result.replace(/{threshold}/g, "30");
  return result;
};

const getPartsInTimezone = (date, timezone = DEFAULT_TIMEZONE) => {
  try {
    const formatterForParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
    });
    const hour = parseInt(formatterForParts.formatToParts(date).find(p => p.type === "hour")?.value || "12", 10);

    const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(date);
    const dayMap = {
      "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
      "Thursday": 4, "Friday": 5, "Saturday": 6
    };
    const day = dayMap[weekdayName] !== undefined ? dayMap[weekdayName] : date.getDay();
    return { hour, day };
  } catch (error) {
    return { hour: date.getHours(), day: date.getDay() };
  }
};

const determineSegment = ({ recencyDays, ordersLast7d, ordersLast14d, ordersLast30d, ordersLast60d }) => {
  if (recencyDays === 999) return "inactive";
  if (recencyDays > 60) return "reactivate";
  if (recencyDays >= 30 && recencyDays <= 60) return "inactive";
  if ((ordersLast7d >= 1 || ordersLast14d >= 2) && recencyDays <= 7) return "very_active";
  if ((ordersLast30d >= 3 || ordersLast60d >= 5) && recencyDays <= 14) return "loyal";
  if ((ordersLast30d >= 1 || ordersLast60d >= 2) && recencyDays <= 30) return "normal";
  return "normal";
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value, fallback = 0) => {
  const normalized = toSafeNumber(value, fallback);
  return Math.round(normalized * 100) / 100;
};

// Mode function: most common value in an array
const mode = (arr) => {
  if (arr.length === 0) return null;
  const counts = {};
  let maxCount = 0;
  let modeVal = arr[0];
  arr.forEach(val => {
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      modeVal = val;
    }
  });
  return modeVal;
};

// ─── One-time DB lookups cached for the lifetime of a cron run ───────────────

// Find available item of a category containing a keyword (e.g. dessert, boisson)
// NOTE: Called once per run and cached; not per-user.
const findItemFromCategoryKeyword = async (keyword, allCategories, allMenuItems) => {
  const matchedCategoryIds = allCategories
    .filter(c => String(c.name || "").toLowerCase().includes(keyword.toLowerCase()))
    .map(c => c._id);
  if (matchedCategoryIds.length === 0) return null;
  return allMenuItems.find(item =>
    item.is_available &&
    matchedCategoryIds.some(cid => String(cid) === String(item.category?._id || item.category))
  ) || null;
};

// ─── 1. Nightly Scan: prepareDailyOffersJob (00:00 every day) ────────────────
const STRATEGIES_DEFAULTS = [
  {
    strategyId: 1,
    segment: "normal",
    group: "ACQUISITION",
    priority: 100,
    cooldownDays: 9999, // Unique
    validityHours: 72,
    offerType: "discount_order",
    discountValue: 20,
    bonusThreshold: 20,
    notificationTitle: "🍔 Une petite faim ? Profite de 20% sur ta première commande !",
    notificationBody: "Profite de 20% de rabais sur ta première commande dès 20$ (max 8$ de rabais)."
  },
  {
    strategyId: 2,
    segment: "normal",
    group: "HABITUDE",
    priority: 98,
    cooldownDays: 9999,
    validityHours: 72,
    offerType: "free_delivery",
    discountValue: 0,
    bonusThreshold: 20,
    notificationTitle: "🚗 On remet ça ? Livraison offerte pour 72 h !",
    notificationBody: "Livraison offerte sur ta deuxième commande dès 20$ d'achat."
  },
  {
    strategyId: 3,
    segment: "normal",
    group: "HABITUDE",
    priority: 96,
    cooldownDays: 9999,
    validityHours: 72,
    offerType: "bonus_basket",
    discountValue: 5,
    bonusThreshold: 25,
    notificationTitle: "🔥 Déjà 2 commandes ! Voici 5$ pour ta prochaine.",
    notificationBody: "Profite de 5$ de rabais sur ta commande dès 25$ d'achat."
  },
  {
    strategyId: 4,
    segment: "loyal",
    group: "HABITUDE",
    priority: 88,
    cooldownDays: 14,
    validityHours: 72,
    offerType: "free_item",
    discountValue: 0,
    bonusThreshold: 30,
    notificationTitle: "🎁 Tu deviens un régulier ! Un extra gratuit t’attend.",
    notificationBody: "Un dessert au choix offert pour ta prochaine commande dès 30$."
  },
  {
    strategyId: 5,
    segment: "loyal",
    group: "FIDELITE",
    priority: 82,
    cooldownDays: 21,
    validityHours: 72,
    offerType: "bonus_basket",
    discountValue: 7,
    bonusThreshold: 35,
    notificationTitle: "⭐ Une récompense Courteau t’attend : 7$ dès 35$ !",
    notificationBody: "Profite de 7$ de rabais sur ta prochaine commande dès 35$."
  },
  {
    strategyId: 6,
    segment: "loyal",
    group: "FIDELITE",
    priority: 55,
    cooldownDays: 21,
    validityHours: 72,
    offerType: "free_item",
    discountValue: 0,
    bonusThreshold: 30,
    notificationTitle: "🎁 Merci d’être un régulier ! Ta récompense est prête.",
    notificationBody: "Une boisson ou dessert offert dès 30$ d'achat."
  },
  {
    strategyId: 7,
    segment: "very_active",
    group: "FIDELITE",
    priority: 40,
    cooldownDays: 30,
    validityHours: 72,
    offerType: "free_item",
    discountValue: 0,
    bonusThreshold: 35,
    notificationTitle: "👑 Une surprise VIP Courteau vient d’être débloquée !",
    notificationBody: "Un dessert ou accompagnement VIP offert dès 35$ d'achat."
  },
  {
    strategyId: 8,
    segment: "normal",
    group: "REACTIVATION",
    priority: 68,
    cooldownDays: 10,
    validityHours: 48,
    offerType: "free_delivery",
    discountValue: 0,
    bonusThreshold: 25,
    notificationTitle: "👀 Ça fait un petit bout ! Livraison offerte pour ton retour.",
    notificationBody: "Livraison gratuite sur ta prochaine commande dès 25$."
  },
  {
    strategyId: 9,
    segment: "normal",
    group: "REACTIVATION",
    priority: 78,
    cooldownDays: 14,
    validityHours: 48,
    offerType: "bonus_basket",
    discountValue: 5,
    bonusThreshold: 25,
    notificationTitle: "🍟 Tu nous manques ! 5$ de rabais dès 25$.",
    notificationBody: "Économise 5$ sur ta prochaine commande dès 25$."
  },
  {
    strategyId: 10,
    segment: "inactive",
    group: "REACTIVATION",
    priority: 92,
    cooldownDays: 21,
    validityHours: 48,
    offerType: "discount_order",
    discountValue: 20,
    bonusThreshold: 25,
    notificationTitle: "🔥 Reviens nous voir : 20% de rabais pour 48 h !",
    notificationBody: "Profite de 20% de rabais sur ta commande dès 25$ (max 10$ de rabais)."
  },
  {
    strategyId: 11,
    segment: "reactivate",
    group: "REACTIVATION",
    priority: 94,
    cooldownDays: 45,
    validityHours: 72,
    offerType: "discount_order",
    discountValue: 25,
    bonusThreshold: 25,
    notificationTitle: "😋 Ça fait longtemps ! 25% pour ton retour chez Courteau.",
    notificationBody: "Bénéficie de 25% de rabais sur ta commande dès 25$ (max 12$ de rabais)."
  },
  {
    strategyId: 12,
    segment: "reactivate",
    group: "REACTIVATION",
    priority: 97,
    cooldownDays: 60,
    validityHours: 72,
    offerType: "bonus_basket",
    discountValue: 10,
    bonusThreshold: 30,
    notificationTitle: "💥 10$ pour ton retour chez Courteau dès 30$ !",
    notificationBody: "Profite de 10$ de rabais sur ta commande dès 30$ d'achat."
  },
  {
    strategyId: 13,
    segment: "normal",
    group: "PANIER",
    priority: 45,
    cooldownDays: 21,
    validityHours: 48,
    offerType: "bonus_basket",
    discountValue: 5,
    bonusThreshold: 30,
    notificationTitle: "🍔 Fais-toi plaisir : 5$ de rabais dès 30$ !",
    notificationBody: "Profite de 5$ de rabais dès que ta commande atteint 30$."
  },
  {
    strategyId: 14,
    segment: "normal",
    group: "PANIER",
    priority: 40,
    cooldownDays: 21,
    validityHours: 48,
    offerType: "free_item",
    discountValue: 0,
    bonusThreshold: 35,
    notificationTitle: "🎁 Un extra gratuit t’attend dès 35$ !",
    notificationBody: "Une boisson ou dessert offert pour toute commande dès 35$."
  },
  {
    strategyId: 15,
    segment: "normal",
    group: "PANIER",
    priority: 30,
    cooldownDays: 30,
    validityHours: 48,
    offerType: "bonus_basket",
    discountValue: 7,
    bonusThreshold: 50,
    notificationTitle: "🔥 7$ de rabais dès 50$ pour 48 h !",
    notificationBody: "Profite de 7$ de rabais dès que ta commande atteint 50$."
  },
  {
    strategyId: 16,
    segment: "normal",
    group: "PANIER",
    priority: 25,
    cooldownDays: 30,
    validityHours: 48,
    offerType: "bonus_basket",
    discountValue: 10,
    bonusThreshold: 65,
    notificationTitle: "🎉 10$ de rabais dès 65$ sur ta prochaine commande !",
    notificationBody: "Profite de 10$ de rabais dès que ta commande atteint 65$."
  },
  {
    strategyId: 17,
    segment: "normal",
    group: "AFFINITE",
    priority: 50,
    cooldownDays: 21,
    validityHours: 48,
    offerType: "discount_category",
    discountValue: 10,
    bonusThreshold: 25,
    notificationTitle: "🍽️ On connaît ton faible… une offre {category} t'attend !",
    notificationBody: "Profite de 10% de réduction sur ta catégorie préférée dès 25$ (max 6$ de rabais)."
  },
  {
    strategyId: 18,
    segment: "normal",
    group: "DECOUVERTE",
    priority: 35,
    cooldownDays: 30,
    validityHours: 48,
    offerType: "discount_category",
    discountValue: 15,
    bonusThreshold: 20,
    notificationTitle: "👀 Jamais essayé ça chez Courteau ? Profite de 15% !",
    notificationBody: "Profite de 15% de rabais sur notre catégorie {category} dès 20$."
  }
];

const prepareDailyOffersJob = async () => {
  console.log("[prepareDailyOffersJob] Starting nightly Smart Offers job...");
  const jobStart = Date.now();

  try {
    // Drop the old segment unique index if it exists in MongoDB
    try {
      await mongoose.connection.db.collection("smartofferrules").dropIndex("segment_1");
      console.log("[prepareDailyOffersJob] Dropped legacy segment_1 unique index successfully.");
    } catch (e) {
      // Ignore if index doesn't exist
    }

    // ── Pre-load static data ONCE for the entire run ──────────────────────────
    const allCategories = await Category.find().lean();
    const allMenuItems  = await MenuItem.find({ is_available: true }).lean();
    let allRules        = await SmartOfferRule.find().lean();

    const cachedDessertItem = await findItemFromCategoryKeyword("dessert", allCategories, allMenuItems);
    const cachedDrinkItem   =
      await findItemFromCategoryKeyword("boisson", allCategories, allMenuItems) ||
      await findItemFromCategoryKeyword("drink",   allCategories, allMenuItems);

    // Build menuItemToCategoryMap FIRST (needed for top-category computation below)
    const menuItemToCategoryMap = {};
    allMenuItems.forEach(item => {
      menuItemToCategoryMap[String(item._id)] = item.category
        ? String(item.category._id || item.category)
        : null;
    });

    // ── Compute top category (most sold in last 90 days) and store in SystemStat ──
    const date90dAgo = new Date(Date.now() - 90 * 86400000);
    const topItemDocs = await Order.aggregate([
      { $match: { createdAt: { $gte: date90dAgo } } },
      { $unwind: "$orderItems" },
      { $group: { _id: "$orderItems.item", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);
    const catSalesCount = {};
    for (const doc of topItemDocs) {
      if (!doc._id) continue;
      const catId = menuItemToCategoryMap[String(doc._id)];
      if (catId) catSalesCount[catId] = (catSalesCount[catId] || 0) + doc.count;
    }
    const sortedCatIds = Object.entries(catSalesCount).sort((a, b) => b[1] - a[1]);
    let topCategoryDoc = null;
    if (sortedCatIds.length > 0) {
      topCategoryDoc = allCategories.find(c => String(c._id) === sortedCatIds[0][0]) || null;
    }
    if (topCategoryDoc) {
      await SystemStat.findOneAndUpdate(
        { key: "topCategory" },
        { key: "topCategory", value: { _id: topCategoryDoc._id, name: topCategoryDoc.name }, updatedAt: new Date() },
        { upsert: true }
      );
      console.log(`[prepareDailyOffersJob] Top category computed: ${topCategoryDoc.name}`);
    }

    // Seed rules if missing
    let rulesCreated = false;
    for (const def of STRATEGIES_DEFAULTS) {
      const exists = allRules.some(r => r.strategyId === def.strategyId);
      if (!exists) {
        let targetCategory = null;
        // S17 and S18 are dynamic per-user; no fixed targetCategory at seeding time

        let freeItem = null;
        if ([4, 6, 7, 14].includes(def.strategyId)) {
          freeItem = [4, 14].includes(def.strategyId) ? (cachedDessertItem?._id || null) : (cachedDrinkItem?._id || null);
        }

        await SmartOfferRule.create({
          strategyId: def.strategyId,
          segment: def.segment,
          group: def.group,
          priority: def.priority,
          cooldownDays: def.cooldownDays,
          validityHours: def.validityHours,
          offerType: def.offerType,
          discountValue: def.discountValue,
          bonusThreshold: def.bonusThreshold,
          targetCategory,
          freeItem,
          notificationTitle: def.notificationTitle,
          notificationBody: def.notificationBody,
          isActive: true
        });
        rulesCreated = true;
        console.log(`[prepareDailyOffersJob] Seeded SmartOfferRule for S${def.strategyId}`);
      }
    }

    if (rulesCreated) {
      allRules = await SmartOfferRule.find().lean();
    }



    // ── Load top category from SystemStat (computed above) ───────────────────
    let topCategoryForDiscovery = topCategoryDoc;
    if (!topCategoryForDiscovery) {
      const storedStat = await SystemStat.findOne({ key: "topCategory" }).lean();
      if (storedStat?.value) {
        topCategoryForDiscovery = allCategories.find(c => String(c._id) === String(storedStat.value._id)) || null;
      }
    }

    const ruleByStrategyId = {};
    allRules.forEach(r => { ruleByStrategyId[r.strategyId] = r; });

    // ── Cursor-based batch iteration over users ───────────────────────────────
    const userCursor = User.find({ isBanned: { $ne: true } })
      .select("_id name email expo_token appIsInstalled emailUnsubscribed createdAt")
      .lean()
      .cursor();

    const now = new Date();
    let batchBuffer   = [];
    let totalProcessed = 0;
    let totalPrepared  = 0;
    let totalSkipped   = 0;

    const processBatch = async (users) => {
      const userIds = users.map(u => u._id);

      // ── Bulk-fetch orders for all users in the batch ───────────────────────
      const batchOrders = await Order.find({
        user: { $in: userIds },
        status: { $ne: "cancelled" }
      })
        .select("user createdAt sub_total total_price orderItems discount personalizedOffer")
        .lean();

      const ordersByUser = {};
      batchOrders.forEach(o => {
        const uid = String(o.user);
        if (!ordersByUser[uid]) ordersByUser[uid] = [];
        ordersByUser[uid].push(o);
      });

      // ── Bulk-fetch existing offers for the last 90 days (for cooldowns) ───
      const date90d = new Date(now.getTime() - 90 * 86400000);
      const batchOffers = await PersonalizedOffer.find({
        user: { $in: userIds },
        createdAt: { $gte: date90d }
      }).lean();

      const offersByUser = {};
      batchOffers.forEach(o => {
        const uid = String(o.user);
        if (!offersByUser[uid]) offersByUser[uid] = [];
        offersByUser[uid].push(o);
      });

      // ── R15: Cancel/expire obsolete prepared/active offers if they ordered ──
      const activeOffers = await PersonalizedOffer.find({
        user: { $in: userIds },
        status: { $in: ["prepared", "active", "viewed", "clicked"] }
      }).lean();

      const usersWithActiveOffer = new Set();
      const offersToExpire = [];

      activeOffers.forEach(offer => {
        const uid = String(offer.user);
        const orders = ordersByUser[uid] || [];
        const hasOrderedSince = orders.some(o => new Date(o.createdAt) > new Date(offer.createdAt));
        if (hasOrderedSince) {
          offersToExpire.push(offer._id);
        } else {
          usersWithActiveOffer.add(uid);
        }
      });

      if (offersToExpire.length > 0) {
        await PersonalizedOffer.updateMany(
          { _id: { $in: offersToExpire } },
          { $set: { status: "expired" } }
        );
      }

      // ── Per-user logic ─────────────────────────────────────────────────────
      const profileUpserts    = [];
      const newOffersToInsert = [];

      for (const user of users) {
        try {
          const uid    = String(user._id);
          const orders = ordersByUser[uid] || [];
          const userOffers = offersByUser[uid] || [];

          // Skip if user already has a valid active offer
          if (usersWithActiveOffer.has(uid)) {
            totalSkipped++;
            continue;
          }

          // ── Compute RFM metrics ───────────────────────────────────────────
          let preferredHour     = 12;
          let preferredDay      = 0;
          let lastOrderAt       = null;
          const orderCount      = orders.length;
          let recencyDays       = 999;
          let ordersLast7d      = 0;
          let ordersLast14d     = 0;
          let ordersLast30d     = 0;
          let ordersLast60d     = 0;
          let ordersLast90d     = 0;
          let averageBasketSize = 0;
          let avgBasket90d      = 0;
          let basketSizeStdDev  = 0;
          const categoryShare90d = new Map();

          if (orders.length > 0) {
            const hours  = [];
            const days   = [];
            const totals = [];
            const totals90d = [];
            const date7d  = new Date(now.getTime() -  7 * 86400000);
            const date14d = new Date(now.getTime() - 14 * 86400000);
            const date30d = new Date(now.getTime() - 30 * 86400000);
            const date60d = new Date(now.getTime() - 60 * 86400000);

            const catCount90d = {};
            let totalItemsOrdered90d = 0;

            orders.forEach(o => {
              const parts     = getPartsInTimezone(o.createdAt);
              const orderDate = new Date(o.createdAt);
              hours.push(parts.hour);
              days.push(parts.day);
              if (orderDate >= date7d)  ordersLast7d++;
              if (orderDate >= date14d) ordersLast14d++;
              if (orderDate >= date30d) ordersLast30d++;
              if (orderDate >= date60d) ordersLast60d++;
              if (orderDate >= date90d) {
                ordersLast90d++;
                totals90d.push(toSafeNumber(o.sub_total || o.total_price, 0));
                
                (o.orderItems || []).forEach(item => {
                  if (item.item) {
                    const categoryId = menuItemToCategoryMap[String(item.item)];
                    if (categoryId) {
                      catCount90d[categoryId] = (catCount90d[categoryId] || 0) + 1;
                      totalItemsOrdered90d++;
                    }
                  }
                });
              }
              totals.push(toSafeNumber(o.sub_total || o.total_price, 0));
              if (!lastOrderAt || o.createdAt > lastOrderAt) lastOrderAt = o.createdAt;
            });

            preferredHour = mode(hours) ?? 12;
            preferredDay  = mode(days)  ?? 0;
            recencyDays   = Math.floor((now - new Date(lastOrderAt)) / 86400000);

            const sum = totals.reduce((a, b) => a + b, 0);
            averageBasketSize = roundMoney(sum / totals.length, 0);
            if (totals.length > 1) {
              const variance = totals.reduce((a, b) => a + Math.pow(b - averageBasketSize, 2), 0) / (totals.length - 1);
              basketSizeStdDev = roundMoney(Math.sqrt(variance), 0);
            }

            if (totals90d.length > 0) {
              const sum90d = totals90d.reduce((a, b) => a + b, 0);
              avgBasket90d = roundMoney(sum90d / totals90d.length, 0);
            }

            if (totalItemsOrdered90d > 0) {
              Object.keys(catCount90d).forEach(cid => {
                categoryShare90d.set(cid, catCount90d[cid] / totalItemsOrdered90d);
              });
            }
          }

          const segment = determineSegment({ recencyDays, ordersLast7d, ordersLast14d, ordersLast30d, ordersLast60d });

          // Queue UserSmartProfile update
          profileUpserts.push({
            updateOne: {
              filter: { user: user._id },
              update: {
                $set: {
                  preferredHour,
                  preferredDay,
                  segment,
                  lastOrderAt,
                  orderCount,
                  ordersCount7d:  ordersLast7d,
                  ordersCount14d: ordersLast14d,
                  ordersCount30d: ordersLast30d,
                  ordersCount60d: ordersLast60d,
                  averageBasketSize,
                  basketSizeStdDev,
                  ordersCount90d: ordersLast90d,
                  avgBasket90d,
                  categoryShare90d
                }
              },
              upsert: true,
            }
          });

          // ── Evaluate candidates ───────────────────────────────────────────
          const candidates = [];
          const accountAgeDays = (now - new Date(user.createdAt || 0)) / 86400000;

          const getStrategyCooldownPassed = (strategyId, defaultCooldownDays) => {
            const dbRuleCooldown = ruleByStrategyId[strategyId]?.cooldownDays;
            const cooldownDays = dbRuleCooldown !== undefined ? dbRuleCooldown : defaultCooldownDays;

            if (cooldownDays === 9999) {
              const hasOffer = userOffers.some(o => o.strategyId === strategyId);
              return !hasOffer;
            }
            const stratOffers = userOffers.filter(o => o.strategyId === strategyId);
            if (stratOffers.length === 0) return true;
            stratOffers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const last = stratOffers[0];
            if (["applied", "expired"].includes(last.status)) {
              const diffDays = (Date.now() - new Date(last.updatedAt).getTime()) / 86400000;
              return diffDays >= cooldownDays;
            }
            return false;
          };

          // S18 — Découverte: check if user has never ordered in the top restaurant category
          let userHasOrderedTopCat = false;
          if (topCategoryForDiscovery) {
            userHasOrderedTopCat = orders.some(o =>
              (o.orderItems || []).some(item =>
                item.item && menuItemToCategoryMap[String(item.item)] === String(topCategoryForDiscovery._id)
              )
            );
          }

          // S01
          if (orderCount === 0 && accountAgeDays >= 1) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 1);
            if (getStrategyCooldownPassed(1, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S02
          if (orderCount === 1 && recencyDays >= 4) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 2);
            if (getStrategyCooldownPassed(2, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S03
          if (orderCount === 2 && recencyDays >= 7) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 3);
            if (getStrategyCooldownPassed(3, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S04
          if (ordersLast30d === 3 && cachedDessertItem) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 4);
            if (getStrategyCooldownPassed(4, strat.cooldownDays)) {
              candidates.push({ ...strat, freeItem: cachedDessertItem._id, targetCategory: cachedDessertItem.category, score: strat.priority });
            }
          }
          // S05
          if (ordersLast30d === 4) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 5);
            if (getStrategyCooldownPassed(5, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S06
          if (ordersLast30d >= 5 && ordersLast30d <= 7 && (cachedDessertItem || cachedDrinkItem)) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 6);
            if (getStrategyCooldownPassed(6, strat.cooldownDays)) {
              const item = cachedDessertItem || cachedDrinkItem;
              candidates.push({ ...strat, freeItem: item._id, targetCategory: item.category, score: strat.priority });
            }
          }
          // S07
          if (ordersLast30d >= 8 && cachedDessertItem) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 7);
            if (getStrategyCooldownPassed(7, strat.cooldownDays)) {
              candidates.push({ ...strat, freeItem: cachedDessertItem._id, targetCategory: cachedDessertItem.category, score: strat.priority });
            }
          }
          // S08
          if (recencyDays >= 10 && recencyDays <= 17 && orderCount >= 2) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 8);
            if (getStrategyCooldownPassed(8, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S09
          if (recencyDays >= 18 && recencyDays <= 29 && orderCount >= 1) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 9);
            if (getStrategyCooldownPassed(9, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S10
          if (recencyDays >= 30 && recencyDays <= 59 && orderCount >= 1) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 10);
            if (getStrategyCooldownPassed(10, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S11
          if (recencyDays >= 60 && recencyDays <= 89 && orderCount >= 1) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 11);
            if (getStrategyCooldownPassed(11, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S12
          if (recencyDays >= 90 && orderCount >= 1) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 12);
            if (getStrategyCooldownPassed(12, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S13
          if (ordersLast90d >= 3 && avgBasket90d < 20) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 13);
            if (getStrategyCooldownPassed(13, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S14
          if (ordersLast90d >= 3 && avgBasket90d >= 20 && avgBasket90d < 35 && cachedDessertItem) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 14);
            if (getStrategyCooldownPassed(14, strat.cooldownDays)) {
              candidates.push({ ...strat, freeItem: cachedDessertItem._id, targetCategory: cachedDessertItem.category, score: strat.priority });
            }
          }
          // S15
          if (ordersLast90d >= 3 && avgBasket90d >= 35 && avgBasket90d <= 50) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 15);
            if (getStrategyCooldownPassed(15, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S16
          if (ordersLast90d >= 3 && avgBasket90d > 50) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 16);
            if (getStrategyCooldownPassed(16, strat.cooldownDays)) {
              candidates.push({ ...strat, score: strat.priority });
            }
          }
          // S17 — Dynamic Affinity: find user's dominant category if >= 60%
          if (ordersLast90d >= 3) {
            let dominantCatId = null;
            let dominantShare = 0;
            for (const [catId, share] of categoryShare90d.entries()) {
              if (share >= 0.60 && share > dominantShare) {
                dominantShare = share;
                dominantCatId = catId;
              }
            }
            if (dominantCatId) {
              const dominantCat = allCategories.find(c => String(c._id) === dominantCatId);
              const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 17);
              if (dominantCat && getStrategyCooldownPassed(17, strat.cooldownDays)) {
                candidates.push({
                  ...strat,
                  targetCategory: dominantCat._id,
                  categoryName: dominantCat.name,
                  score: strat.priority
                });
              }
            }
          }
          // S18 — Discovery: user never ordered in restaurant's top category
          if (orderCount >= 3 && topCategoryForDiscovery && !userHasOrderedTopCat) {
            const strat = STRATEGIES_DEFAULTS.find(d => d.strategyId === 18);
            if (strat && getStrategyCooldownPassed(18, strat.cooldownDays)) {
              candidates.push({
                ...strat,
                targetCategory: topCategoryForDiscovery._id,
                categoryName: topCategoryForDiscovery.name,
                score: strat.priority
              });
            }
          }

          // ── R10: Global Cooldown (7 days after any redemption, exception S01-S04) ──
          const redeemedOffers = userOffers.filter(o => o.status === "applied");
          let lastRedeemedAt = null;
          if (redeemedOffers.length > 0) {
            redeemedOffers.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            lastRedeemedAt = redeemedOffers[0].updatedAt;
          }

          let isGlobalCooldownActive = false;
          if (lastRedeemedAt) {
            const diffDays = (Date.now() - new Date(lastRedeemedAt).getTime()) / 86400000;
            if (diffDays < 7) {
              isGlobalCooldownActive = true;
            }
          }

          let filtered = candidates;
          if (isGlobalCooldownActive) {
            filtered = candidates.filter(c => [1, 2, 3, 4].includes(c.strategyId));
          }

          // ── R11: Budget cap rolling 30d (Max 20$, exception S01-S04 Max 25$) ──
          const orders30d = orders.filter(o => {
            const diffDays = (now - new Date(o.createdAt)) / 86400000;
            return diffDays <= 30 && o.personalizedOffer;
          });
          const rollingSubsidy30d = orders30d.reduce((sum, o) => sum + toSafeNumber(o.discount, 0), 0);

          filtered = filtered.filter(c => {
            const limit = [1, 2, 3, 4].includes(c.strategyId) ? 25 : 20;
            return rollingSubsidy30d < limit;
          });

          // ── R12: Max 2 redemptions rolling 30d (exception S01-S04 Max 3) ────
          const redeemedCount30d = redeemedOffers.filter(o => {
            const diffDays = (Date.now() - new Date(o.updatedAt).getTime()) / 86400000;
            return diffDays <= 30;
          }).length;

          filtered = filtered.filter(c => {
            const limit = [1, 2, 3, 4].includes(c.strategyId) ? 3 : 2;
            return redeemedCount30d < limit;
          });

          // ── R13/R14: Push Notification Fatigue (Max 1/48h, Max 3/7d) ──────────
          const pushOffers48h = userOffers.filter(o => {
            if (!o.scheduledNotifyAt) return false;
            const diffDays = (Date.now() - new Date(o.scheduledNotifyAt).getTime()) / 86400000;
            return diffDays >= 0 && diffDays <= 2;
          });
          const pushOffers7d = userOffers.filter(o => {
            if (!o.scheduledNotifyAt) return false;
            const diffDays = (Date.now() - new Date(o.scheduledNotifyAt).getTime()) / 86400000;
            return diffDays >= 0 && diffDays <= 7;
          });

          if (pushOffers48h.length > 0 || pushOffers7d.length >= 3) {
            filtered = [];
          }

          // Filter by rules active state
          filtered = filtered.filter(c => {
            const rule = ruleByStrategyId[c.strategyId];
            return !rule || rule.isActive;
          });

          if (filtered.length === 0) {
            totalSkipped++;
            continue;
          }

          // ── Sort by Matrix Priority ───────────────────────────────────────
          const GROUP_RANKS = {
            ACQUISITION: 7,
            HABITUDE: 6,
            REACTIVATION: 5,
            FIDELITE: 4,
            AFFINITE: 3,
            PANIER: 2,
            DECOUVERTE: 1
          };

          filtered.sort((a, b) => {
            const rankA = GROUP_RANKS[a.group] || 0;
            const rankB = GROUP_RANKS[b.group] || 0;
            if (rankB !== rankA) return rankB - rankA;
            if (b.priority !== a.priority) return b.priority - a.priority;
            return b.score - a.score;
          });

          const selected = filtered[0];
          const rule = ruleByStrategyId[selected.strategyId];

          // ── Compute scheduled notification time ───────────────────────────
          let notifyHour = preferredHour - 1;
          if (notifyHour < 8 || notifyHour > 21) notifyHour = 11;
          const scheduledNotifyAt = new Date();
          scheduledNotifyAt.setHours(notifyHour, 0, 0, 0);

          // ── Personalize text ──────────────────────────────────────────────
          const offerDetails = {
            categoryName: selected.categoryName || "",
            itemName:     selected.itemName     || "",
            discount:     selected.discountValue
              ? (selected.offerType === "bonus_basket" ? `${selected.discountValue}$` : `${selected.discountValue}%`)
              : "",
            threshold:    selected.bonusThreshold || "",
          };
          const templateTitle = selected.notificationTitle || rule?.notificationTitle || "";
          const templateBody  = selected.notificationBody  || rule?.notificationBody  || "";
          const finalTitle    = personalizeText(templateTitle, user, offerDetails);
          const finalBody     = personalizeText(templateBody,  user, offerDetails);

          newOffersToInsert.push({
            user:              user._id,
            rule:              rule?._id || null,
            status:            "prepared",
            offerType:         selected.offerType,
            discountValue:     selected.discountValue  || 0,
            bonusThreshold:    selected.bonusThreshold || 0,
            targetCategory:    selected.targetCategory || null,
            targetMenuItem:    selected.targetMenuItem || null,
            freeItem:          selected.freeItem       || null,
            scheduledNotifyAt,
            notificationTitle: finalTitle,
            notificationBody:  finalBody,
            score:             selected.score     || 0,
            strategyId:        selected.strategyId || null,
          });

          totalPrepared++;
        } catch (userErr) {
          console.error(`[prepareDailyOffersJob] Error processing user ${user._id}:`, userErr.message);
        }
      }

      // ── Flush UserSmartProfile upserts ────────────────────────────────────
      if (profileUpserts.length > 0) {
        await UserSmartProfile.bulkWrite(profileUpserts, { ordered: false });
      }

      // ── Bulk insert new PersonalizedOffers ────────────────────────────────
      if (newOffersToInsert.length > 0) {
        await PersonalizedOffer.insertMany(newOffersToInsert, { ordered: false });
      }

      totalProcessed += users.length;
      console.log(
        `[prepareDailyOffersJob] Batch done — processed: ${totalProcessed}, ` +
        `prepared: ${totalPrepared}, skipped: ${totalSkipped}`
      );
    };

    // ── Stream users through cursor, buffer into batches ─────────────────────
    for await (const user of userCursor) {
      batchBuffer.push(user);
      if (batchBuffer.length >= PREPARE_BATCH_SIZE) {
        await processBatch(batchBuffer);
        batchBuffer = [];
        await sleep(PREPARE_BATCH_DELAY);
      }
    }
    // Flush remaining users
    if (batchBuffer.length > 0) {
      await processBatch(batchBuffer);
    }

    const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
    console.log(
      `[prepareDailyOffersJob] ✅ Finished in ${elapsed}s — ` +
      `total: ${totalProcessed}, prepared: ${totalPrepared}, skipped: ${totalSkipped}`
    );
  } catch (error) {
    console.error("[prepareDailyOffersJob] Fatal error:", error);
  }
};

// ─── 2. Periodic Trigger: triggerScheduledOffersJob (every 5 min) ────────────
const triggerScheduledOffersJob = async () => {
  console.log("[triggerScheduledOffersJob] Starting periodic Smart Offers activation job...");
  try {
    const now = new Date();

    // ── Activate prepared offers (in batches to avoid hammering DB) ──────────
    // Only fetch a limited batch per tick to keep DB load low
    const preparedOffers = await PersonalizedOffer.find({
      status: "prepared",
      scheduledNotifyAt: { $lte: now }
    })
      .limit(TRIGGER_BATCH_SIZE)   // ← never processes more than N at a time
      .populate("user rule")
      .lean();

    if (preparedOffers.length > 0) {
      console.log(`[triggerScheduledOffersJob] Found ${preparedOffers.length} offers to activate.`);
      const expo        = new Expo({ useFcmV1: true });
      const messages    = [];
      const tokenInfos  = [];
      const emailQueue  = []; // handle emails after push, avoid blocking push loop

      for (const offer of preparedOffers) {
        const ruleValidityHours = offer.rule?.validityHours || 24;
        const validFrom         = new Date();
        const validUntil        = new Date(validFrom.getTime() + ruleValidityHours * 3600000);

        if (
          offer.user &&
          offer.user.expo_token &&
          Expo.isExpoPushToken(offer.user.expo_token) &&
          offer.user.appIsInstalled !== false
        ) {
          messages.push({
            to:       offer.user.expo_token,
            sound:    "default",
            title:    offer.notificationTitle,
            body:     offer.notificationBody,
            priority: "high",
            data: {
              type:    "smart_offer",
              offerId: String(offer._id),
              userId:  String(offer.user._id || offer.user),
            },
          });
          tokenInfos.push({
            offerId:    offer._id,
            userId:     offer.user._id,
            offerTitle: offer.notificationTitle,
            offerBody:  offer.notificationBody,
            validFrom,
            validUntil,
          });
        } else {
          // Uninstalled or no push token → queue email
          if (offer.user && offer.user.email && !offer.user.emailUnsubscribed) {
            emailQueue.push({
              userEmail:  offer.user.email,
              userName:   offer.user.name,
              offerTitle: offer.notificationTitle,
              offerBody:  offer.notificationBody,
              userId:     String(offer.user._id || offer.user),
            });
          }
          // Activate the offer immediately (no push)
          await PersonalizedOffer.findByIdAndUpdate(offer._id, { status: "active", validFrom, validUntil });
          await new PersonalizedOfferEvent({
            personalizedOffer: offer._id,
            user:              offer.user?._id,
            eventType:         "created",
          }).save();
        }
      }

      // ── Send push notifications in Expo chunks ────────────────────────────
      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        let cursor   = 0;
        for (const chunk of chunks) {
          const tickets = await expo.sendPushNotificationsAsync(chunk);

          // Batch DB writes for this chunk
          const offerActivations = [];
          const eventInserts     = [];

          for (let i = 0; i < tickets.length; i++) {
            const tokenInfo = tokenInfos[cursor + i];
            const ticket    = tickets[i];

            if (ticket?.status === "ok") {
              if (ticket.id) {
                pendingReceiptMap[ticket.id] = { offerId: tokenInfo.offerId, userId: tokenInfo.userId };
              }
              offerActivations.push({
                updateOne: {
                  filter: { _id: tokenInfo.offerId },
                  update: { $set: { status: "active", validFrom: tokenInfo.validFrom, validUntil: tokenInfo.validUntil } },
                }
              });
              eventInserts.push({
                personalizedOffer: tokenInfo.offerId,
                user:              tokenInfo.userId,
                eventType:         "notified",
              });
            } else {
              const errCode = ticket?.details?.error;
              if (errCode === "DeviceNotRegistered") {
                console.log(`[triggerScheduledOffersJob] DeviceNotRegistered for user ${tokenInfo.userId}`);
                const uninstalledUser = await User.findByIdAndUpdate(
                  tokenInfo.userId,
                  { expo_token: null, appIsInstalled: false, appUninstalledAt: new Date() },
                  { new: true }
                ).lean();
                if (uninstalledUser?.email && !uninstalledUser.emailUnsubscribed) {
                  emailQueue.push({
                    userEmail:  uninstalledUser.email,
                    userName:   uninstalledUser.name,
                    offerTitle: tokenInfo.offerTitle,
                    offerBody:  tokenInfo.offerBody,
                    userId:     String(uninstalledUser._id),
                  });
                }
              }
              // Activate anyway so the offer is visible if the app is reinstalled
              offerActivations.push({
                updateOne: {
                  filter: { _id: tokenInfo.offerId },
                  update: { $set: { status: "active", validFrom: tokenInfo.validFrom, validUntil: tokenInfo.validUntil } },
                }
              });
            }
          }

          // Flush batch DB writes for this chunk
          if (offerActivations.length > 0) {
            await PersonalizedOffer.bulkWrite(offerActivations, { ordered: false });
          }
          if (eventInserts.length > 0) {
            await PersonalizedOfferEvent.insertMany(eventInserts, { ordered: false });
          }

          cursor += chunk.length;
          await sleep(TRIGGER_BATCH_DELAY);
        }
      }

      // ── Send emails (after push, non-blocking in series to avoid spam) ─────
      for (const emailPayload of emailQueue) {
        try {
          await sendSmartOfferUninstalledEmail(emailPayload);
        } catch (emailErr) {
          console.error(`[triggerScheduledOffersJob] Email error for ${emailPayload.userId}:`, emailErr.message);
        }
      }
    }

    // ── 1. Expire active/viewed/clicked offers whose validUntil has passed ────
    const expiredResult = await PersonalizedOffer.updateMany(
      {
        status:    { $in: ["active", "viewed", "clicked"] },
        validUntil: { $lt: now },
      },
      { $set: { status: "expired" } }
    );

    if (expiredResult.modifiedCount > 0) {
      console.log(`[triggerScheduledOffersJob] Expired ${expiredResult.modifiedCount} active/viewed/clicked offers.`);
      // Bulk insert expired events for recently-expired offers
      const expiredOfferDocs = await PersonalizedOffer.find({
        status:    "expired",
        validUntil: { $lt: now },
        updatedAt:  { $gte: new Date(Date.now() - 60000) } // only those just expired this tick
      })
        .select("_id user")
        .lean();

      if (expiredOfferDocs.length > 0) {
        const expiredEvents = expiredOfferDocs.map(o => ({
          personalizedOffer: o._id,
          user:              o.user,
          eventType:         "expired",
        }));
        await PersonalizedOfferEvent.insertMany(expiredEvents, { ordered: false });
      }
    }

    // ── 2. Expire stale "prepared" offers that were never triggered (> 48h) ───
    // This happens when the server was down at the scheduled time, or the
    // offer was never triggered for any other reason. We clean them up so the
    // user is eligible for a fresh offer on the next nightly scan.
    const stalePreparedCutoff = new Date(now.getTime() - 48 * 3600000);
    const stalePreparedResult = await PersonalizedOffer.updateMany(
      {
        status:    "prepared",
        createdAt: { $lt: stalePreparedCutoff },
      },
      { $set: { status: "expired" } }
    );

    if (stalePreparedResult.modifiedCount > 0) {
      console.log(
        `[triggerScheduledOffersJob] Cleaned up ${stalePreparedResult.modifiedCount} stale "prepared" offers (never triggered, > 48h old).`
      );
    }

    console.log("[triggerScheduledOffersJob] ✅ Periodic activation job finished.");
  } catch (error) {
    console.error("[triggerScheduledOffersJob] Error:", error);
  }
};

// ─── 3. Push Receipt Checker (every hour) ────────────────────────────────────
const checkPushReceiptsJob = async () => {
  const ticketIds = Object.keys(pendingReceiptMap);
  if (ticketIds.length === 0) return;

  console.log(`[checkPushReceiptsJob] Checking ${ticketIds.length} pending Expo push receipts...`);
  const expo = new Expo({ useFcmV1: true });

  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
    for (const chunk of receiptIdChunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        const info = pendingReceiptMap[receiptId];
        if (!info) continue;

        if (receipt.status === "ok") {
          delete pendingReceiptMap[receiptId];
        } else if (receipt.status === "error") {
          const errCode = receipt.details?.error;
          console.log(`[checkPushReceiptsJob] Receipt error for user ${info.userId}: ${errCode}`);
          if (errCode === "DeviceNotRegistered") {
            await User.findByIdAndUpdate(info.userId, {
              expo_token:       null,
              appIsInstalled:   false,
              appUninstalledAt: new Date(),
            });
            console.log(`[checkPushReceiptsJob] User ${info.userId} marked as uninstalled.`);
          }
          delete pendingReceiptMap[receiptId];
        }
      }
    }
  } catch (err) {
    console.error("[checkPushReceiptsJob] Error fetching receipts:", err);
  }
};

// ─── Scheduler registration ───────────────────────────────────────────────────
function startPersonalizedOffersJobs() {
  // Nightly scan: 00:00
  cron.schedule("0 0 * * *", async () => { await prepareDailyOffersJob(); }, { timezone: DEFAULT_TIMEZONE });

  // Trigger & expire: every 5 minutes
  cron.schedule("*/5 * * * *", async () => { await triggerScheduledOffersJob(); }, { timezone: DEFAULT_TIMEZONE });

  // Receipt checker: every hour
  cron.schedule("0 * * * *", async () => { await checkPushReceiptsJob(); }, { timezone: DEFAULT_TIMEZONE });

  console.log(`[personalizedOffersJobs] ✅ Nightly scan:     00:00 (${DEFAULT_TIMEZONE})`);
  console.log(`[personalizedOffersJobs] ✅ Periodic trigger: every 5 min (${DEFAULT_TIMEZONE})`);
  console.log(`[personalizedOffersJobs] ✅ Receipt checker:  every hour (${DEFAULT_TIMEZONE})`);
}

module.exports = {
  startPersonalizedOffersJobs,
  prepareDailyOffersJob,
  triggerScheduledOffersJob,
  checkPushReceiptsJob,
};
