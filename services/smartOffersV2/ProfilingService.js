const mongoose = require("mongoose");
const User = require("../../models/User");
const Order = require("../../models/Order");
const Category = require("../../models/Category");
const MenuItem = require("../../models/MenuItem");
const UserSmartProfile = require("../../models/UserSmartProfile");
const SmartOfferRule = require("../../models/SmartOfferRule"); // Legacy
const Campaign = require("../../models/Campaign");
const DynamicRule = require("../../models/DynamicRule");
const PersonalizedOffer = require("../../models/PersonalizedOffer");
const SmartOfferWaveReset = require("../../models/SmartOfferWaveReset");
const SystemStat = require("../../models/SystemStat");
const { CANCELED } = require("../../utils/constants");
const { renderBasketStrategyNotification } = require("../offersServices/smartOfferTemplateService");
const RuleEvaluatorService = require("./RuleEvaluatorService");
const OfferDistributionService = require("./OfferDistributionService");

const DEFAULT_TIMEZONE = "America/Toronto";
const CANCELED_ORDER_STATUSES = [CANCELED, "cancelled", "canceled"];

const PREPARE_BATCH_SIZE   = 100;
const PREPARE_BATCH_DELAY  = 200;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const personalizeText = (text, user, offerDetails = {}) => {
  if (!text) return "";
  const name = user.name ? user.name.trim() : "cher client";
  let result = text.replace(/{{name}}/g, name).replace(/{name}/g, name);

  if (offerDetails.categoryName) result = result.replace(/{category}/g, offerDetails.categoryName);
  if (offerDetails.itemName) result = result.replace(/{item}/g, offerDetails.itemName);
  if (offerDetails.discount) result = result.replace(/{discount}/g, offerDetails.discount);
  if (offerDetails.points) result = result.replace(/{points}/g, String(offerDetails.points));
  if (offerDetails.threshold !== undefined && offerDetails.threshold !== null && offerDetails.threshold !== "") {
    result = result.replace(/{threshold}/g, String(offerDetails.threshold));
  }
  result = result.replace(/{threshold}/g, "30");
  return result;
};

const getPartsInTimezone = (date, timezone = DEFAULT_TIMEZONE) => {
  try {
    const formatterForParts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, hour: "numeric" });
    const hour = parseInt(formatterForParts.formatToParts(date).find(p => p.type === "hour")?.value || "12", 10);
    const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(date);
    const dayMap = { "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
    const day = dayMap[weekdayName] !== undefined ? dayMap[weekdayName] : date.getDay();
    return { hour, day };
  } catch (error) {
    return { hour: date.getHours(), day: date.getDay() };
  }
};

const torontoDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const torontoOffsetFormatter = new Intl.DateTimeFormat("en-US", { timeZone: DEFAULT_TIMEZONE, timeZoneName: "longOffset" });

// Convertit une heure "murale" de Toronto (ex: 11h le jour calendaire de `date`) en instant UTC réel,
// quel que soit le fuseau horaire du processus Node qui exécute ce code.
const getTorontoWallClockUtc = (date, hour) => {
  const dateParts = Object.fromEntries(torontoDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  const wallClockUtc = new Date(Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), hour));
  const offsetLabel = torontoOffsetFormatter.formatToParts(wallClockUtc).find(({ type }) => type === "timeZoneName")?.value;
  const offsetParts = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offsetLabel || "");
  if (!offsetParts) throw new Error(`Décalage horaire Toronto invalide : ${offsetLabel}`);
  const offsetMinutes = (offsetParts[1] === "+" ? 1 : -1) * (Number(offsetParts[2]) * 60 + Number(offsetParts[3]));
  return new Date(wallClockUtc.getTime() - offsetMinutes * 60000);
};

const getScheduledNotifyAt = (now, notifyHour) => {
  const scheduled = getTorontoWallClockUtc(now, notifyHour);
  return scheduled <= now ? new Date(now) : scheduled;
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

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const determineReactivationProfile = ({ orderCount, recencyDays, medianOrderIntervalDays }) => {
  const hasCadence = orderCount >= 2 && Number.isFinite(medianOrderIntervalDays);
  const recencyToCadenceRatio = hasCadence && medianOrderIntervalDays > 0 ? roundMoney(recencyDays / medianOrderIntervalDays, null) : null;
  const earlyRiskTriggerDay = hasCadence ? Math.max(10, Math.floor(medianOrderIntervalDays * 0.8)) : 10;

  if (orderCount >= 2 && recencyDays >= earlyRiskTriggerDay && recencyDays <= 17) {
    return { reactivationProfile: "early_risk", recommendedReactivationStrategyId: 8, reactivationTriggerDay: earlyRiskTriggerDay, recencyToCadenceRatio };
  }
  if (orderCount >= 1 && orderCount <= 2 && recencyDays >= 18) {
    const recommendedReactivationStrategyId = recencyDays <= 29 ? 9 : recencyDays <= 59 ? 10 : recencyDays <= 89 ? 11 : 12;
    return { reactivationProfile: "early_abandonment", recommendedReactivationStrategyId, reactivationTriggerDay: 18, recencyToCadenceRatio };
  }
  const hasReliableCadence = orderCount >= 3 && Number.isFinite(medianOrderIntervalDays);
  if (hasReliableCadence && medianOrderIntervalDays <= 30) {
    const reactivationTriggerDay = Math.max(18, Math.ceil(medianOrderIntervalDays * 1.5));
    if (recencyDays >= reactivationTriggerDay) {
      return { reactivationProfile: "sudden_stop", recommendedReactivationStrategyId: 19, reactivationTriggerDay, recencyToCadenceRatio };
    }
  }
  if (hasReliableCadence && medianOrderIntervalDays > 30) {
    const reactivationTriggerDay = Math.ceil(medianOrderIntervalDays * 1.2);
    if (recencyDays >= reactivationTriggerDay) {
      return { reactivationProfile: "low_frequency", recommendedReactivationStrategyId: 20, reactivationTriggerDay, recencyToCadenceRatio };
    }
  }
  return { reactivationProfile: orderCount >= 1 ? "not_overdue" : null, recommendedReactivationStrategyId: null, reactivationTriggerDay: null, recencyToCadenceRatio };
};

const findItemFromCategoryKeyword = async (keyword, allCategories, allMenuItems) => {
  const matchedCategoryIds = allCategories.filter(c => String(c.name || "").toLowerCase().includes(keyword.toLowerCase())).map(c => c._id);
  if (matchedCategoryIds.length === 0) return null;
  return allMenuItems.find(item => item.is_available && matchedCategoryIds.some(cid => String(cid) === String(item.category?._id || item.category))) || null;
};

const STRATEGIES_DEFAULTS = [
  { name: "Bienvenue 1re commande", strategyId: 1, segment: "normal", group: "HABITUDE", priority: 100, cooldownDays: 9999, validityHours: 72, offerType: "discount_order", discountValue: 15, bonusThreshold: 20, notificationTitle: "🎉 Bienvenue chez Courteau ! 15% sur ta 1re commande", notificationBody: "Profite de 15% de rabais sur ta première commande dès 20$ d'achat." },
  { name: "Installer l'habitude de la 2e commande", strategyId: 2, segment: "normal", group: "HABITUDE", priority: 98, cooldownDays: 9999, validityHours: 72, offerType: "discount_order", discountValue: 15, bonusThreshold: 20, notificationTitle: "🎁 On remet ça ? 15% de rabais sur ta 2e commande !", notificationBody: "Profite de 15% de rabais sur ta deuxième commande dès 20$ d'achat." },
  { name: "Consolider l'habitude de la 3e commande", strategyId: 3, segment: "normal", group: "HABITUDE", priority: 96, cooldownDays: 9999, validityHours: 72, offerType: "bonus_basket", discountValue: 5, bonusThreshold: 25, notificationTitle: "🔥 Déjà 2 commandes ! Voici 5$ pour ta prochaine.", notificationBody: "Profite de 5$ de rabais sur ta commande dès 25$ d'achat." },
  { name: "Faire franchir le cap de la 4e commande", strategyId: 4, segment: "loyal", group: "HABITUDE", priority: 88, cooldownDays: 14, validityHours: 72, offerType: "free_item", discountValue: 0, bonusThreshold: 30, notificationTitle: "🎁 Tu deviens un régulier ! Un extra gratuit t’attend.", notificationBody: "Un dessert au choix offert pour ta prochaine commande dès 30$." },
  { name: "Transformer en client fidèle à la 5e commande", strategyId: 5, segment: "loyal", group: "FIDELITE", priority: 82, cooldownDays: 21, validityHours: 72, offerType: "bonus_basket", discountValue: 7, bonusThreshold: 35, notificationTitle: "⭐ Une récompense Courteau t’attend : 7$ dès 35$ !", notificationBody: "Profite de 7$ de rabais sur ta prochaine commande dès 35$." },
  { name: "Entretenir la fidélité active", strategyId: 6, segment: "loyal", group: "FIDELITE", priority: 55, cooldownDays: 21, validityHours: 72, offerType: "free_item", discountValue: 0, bonusThreshold: 30, notificationTitle: "🎁 Merci d’être un régulier ! Ta récompense est prête.", notificationBody: "Une boisson ou dessert offert dès 30$ d'achat." },
  { name: "Reconnaître les clients VIP", strategyId: 7, segment: "very_active", group: "FIDELITE", priority: 40, cooldownDays: 30, validityHours: 72, offerType: "free_item", discountValue: 0, bonusThreshold: 35, notificationTitle: "👑 Une surprise VIP Courteau vient d’être débloquée !", notificationBody: "Un dessert ou accompagnement VIP offert dès 35$ d'achat." },
  { name: "Prévenir le décrochage selon la cadence", strategyId: 8, segment: "normal", group: "REACTIVATION", priority: 68, cooldownDays: 10, validityHours: 48, offerType: "discount_order", discountValue: 10, bonusThreshold: 25, notificationTitle: "👀 Ça fait un petit bout ! 10% de rabais pour ton retour.", notificationBody: "Profite de 10% de rabais sur ta prochaine commande dès 25$." },
  { name: "Récupérer les nouveaux clients abandonnés", strategyId: 9, segment: "normal", group: "REACTIVATION", priority: 78, cooldownDays: 14, validityHours: 48, offerType: "bonus_basket", discountValue: 5, bonusThreshold: 25, notificationTitle: "🍟 Tu nous manques ! 5$ de rabais dès 25$.", notificationBody: "Économise 5$ sur ta prochaine commande dès 25$." },
  { name: "Récupérer les nouveaux clients en abandon prolongé", strategyId: 10, segment: "inactive", group: "REACTIVATION", priority: 92, cooldownDays: 21, validityHours: 48, offerType: "bonus_basket", discountValue: 6, bonusThreshold: 25, notificationTitle: "👋 On aimerait te revoir : 6$ pour reprendre l'habitude.", notificationBody: "Profite de 6$ de rabais sur ta prochaine commande dès 25$." },
  { name: "Récupérer les nouveaux clients en abandon ancien", strategyId: 11, segment: "reactivate", group: "REACTIVATION", priority: 94, cooldownDays: 45, validityHours: 72, offerType: "bonus_basket", discountValue: 6, bonusThreshold: 25, notificationTitle: "😋 Ça fait longtemps : 6$ pour redonner une chance à Courteau.", notificationBody: "Profite de 6$ de rabais sur ta prochaine commande dès 25$." },
  { name: "Dernière tentative de récupération des nouveaux clients", strategyId: 12, segment: "reactivate", group: "REACTIVATION", priority: 97, cooldownDays: 9999, validityHours: 72, offerType: "bonus_basket", discountValue: 8, bonusThreshold: 30, notificationTitle: "💥 Une dernière invitation : 8$ pour revenir chez Courteau.", notificationBody: "Profite de 8$ de rabais sur ta prochaine commande dès 30$ d'achat." },
  { name: "Développer les petits paniers", strategyId: 13, segment: "normal", group: "PANIER", priority: 45, cooldownDays: 21, validityHours: 48, offerType: "bonus_basket", discountValue: 5, bonusThreshold: 30, notificationTitle: "🍔 Fais-toi plaisir : 5$ de rabais dès 30$ !", notificationBody: "Profite de 5$ de rabais dès que ta commande atteint 30$." },
  { name: "Faire progresser les paniers intermédiaires", strategyId: 14, segment: "normal", group: "PANIER", priority: 40, cooldownDays: 21, validityHours: 48, offerType: "free_item", discountValue: 0, bonusThreshold: 35, notificationTitle: "🎁 Un extra gratuit t’attend dès 35$ !", notificationBody: "Une boisson ou dessert offert pour toute commande dès 35$." },
  { name: "Faire progresser les grands paniers", strategyId: 15, segment: "normal", group: "PANIER", priority: 30, cooldownDays: 30, validityHours: 48, offerType: "bonus_basket", discountValue: 7, bonusThreshold: 50, notificationTitle: "🔥 7$ de rabais dès 50$ pour 48 h !", notificationBody: "Profite de 7$ de rabais dès que ta commande atteint 50$." },
  { name: "Valoriser les très grands paniers", strategyId: 16, segment: "normal", group: "PANIER", priority: 25, cooldownDays: 30, validityHours: 48, offerType: "bonus_basket", discountValue: 10, bonusThreshold: 65, notificationTitle: "🎉 10$ de rabais dès 65$ sur ta prochaine commande !", notificationBody: "Profite de 10$ de rabais dès que ta commande atteint 65$." },
  { name: "Renforcer l'affinité avec la catégorie favorite", strategyId: 17, segment: "normal", group: "AFFINITE", priority: 50, cooldownDays: 21, validityHours: 48, offerType: "discount_category", discountValue: 10, bonusThreshold: 25, notificationTitle: "🍽️ On connaît ton faible… une offre {category} t'attend !", notificationBody: "Profite de 10% de réduction sur ta catégorie préférée dès 25$." },
  { name: "Développer la découverte de nouvelles catégories", strategyId: 18, segment: "normal", group: "DECOUVERTE", priority: 35, cooldownDays: 30, validityHours: 48, offerType: "discount_category", discountValue: 15, bonusThreshold: 20, notificationTitle: "👀 Jamais essayé ça chez Courteau ? Profite de 15% !", notificationBody: "Profite de 15% de rabais sur notre catégorie {category} dès 20$." },
  { name: "Réactiver après un arrêt soudain", strategyId: 19, segment: "normal", group: "REACTIVATION", priority: 99, cooldownDays: 14, validityHours: 48, offerType: "bonus_basket", discountValue: 5, bonusThreshold: 25, notificationTitle: "🍟 Tu nous manques ! Une offre t'attend pour ton retour.", notificationBody: "Profite de ton offre personnalisée sur ta prochaine commande." },
  { name: "Réactiver les clients à faible fréquence au bon moment", strategyId: 20, segment: "normal", group: "REACTIVATION", priority: 99, cooldownDays: 30, validityHours: 48, offerType: "bonus_basket", discountValue: 5, bonusThreshold: 25, notificationTitle: "👋 Le bon moment pour revenir chez Courteau.", notificationBody: "Profite de ton offre personnalisée sur ta prochaine commande." },
  { name: "Accompagner les très petits paniers (5 à moins de 10 $)", strategyId: 21, segment: "normal", group: "PANIER", priority: 46, cooldownDays: 21, validityHours: 48, offerType: "loyalty_points", bonusPoints: 100, bonusThreshold: 10, notificationTitle: "Un petit bonus pour ton prochain repas ✨", notificationBody: "Gagne {points} points de fidélité dès {threshold} $ d'achat.", isActive: false }
];

const BASKET_STRATEGY_BANDS = [
  { strategyId: 21, min: 5, max: 10, familyId: 13 },
  { strategyId: 13, min: 10, max: 15, familyId: 13 },
  { strategyId: 22, min: 15, max: 20, familyId: 13 },
  { strategyId: 14, min: 20, max: 25, familyId: 14 },
  { strategyId: 23, min: 25, max: 30, familyId: 14 },
  { strategyId: 24, min: 30, max: 35, familyId: 14 },
  { strategyId: 15, min: 35, max: 40, familyId: 15 },
  { strategyId: 25, min: 40, max: 45, familyId: 15 },
  { strategyId: 26, min: 45, max: 50, familyId: 15 },
  { strategyId: 16, min: 50, max: 55, familyId: 16 },
  { strategyId: 27, min: 55, max: 60, familyId: 16 },
  { strategyId: 28, min: 60, max: 65, familyId: 16 },
  { strategyId: 29, min: 65, max: 70, familyId: 16 },
  { strategyId: 30, min: 70, max: 75, familyId: 16 },
  { strategyId: 31, min: 75, max: Infinity, familyId: 16 },
];

for (const band of BASKET_STRATEGY_BANDS) {
  if (STRATEGIES_DEFAULTS.some((strategy) => strategy.strategyId === band.strategyId)) continue;
  const parent = STRATEGIES_DEFAULTS.find((strategy) => strategy.strategyId === band.familyId);
  STRATEGIES_DEFAULTS.push({
    ...parent,
    strategyId: band.strategyId,
    name: `${parent.name} — ${band.max === Infinity ? `${band.min} $ et plus` : `${band.min} à moins de ${band.max} $`}`,
    cloneFromStrategyId: band.familyId,
  });
}

const getBasketStrategyBand = (average) => BASKET_STRATEGY_BANDS.find(({ min, max }) => average >= min && average < max) || null;

const resolveBasketStrategyId = (average, isActive) => {
  const band = getBasketStrategyBand(average);
  if (band?.strategyId === 21 && !isActive(21)) return isActive(13) ? 13 : null;
  if (!band && average < 5 && !isActive(21)) return isActive(13) ? 13 : null;
  return band && isActive(band.strategyId) ? band.strategyId : null;
};

const ensureSmartOfferRules = async ({ cachedDessertItem, cachedDrinkItem, strategyIds } = {}) => {
  try {
    await mongoose.connection.db.collection("smartofferrules").dropIndex("segment_1");
  } catch (error) {
    if (error.codeName !== "IndexNotFound" && error.code !== 27) throw error;
  }

  const existingRules = await SmartOfferRule.find().lean();
  const existingIds = new Set(existingRules.map((rule) => rule.strategyId));
  const createdIds = [];
  
  for (const def of STRATEGIES_DEFAULTS) {
    if (strategyIds && !strategyIds.has(def.strategyId)) continue;
    if (existingIds.has(def.strategyId)) continue;
    
    const source = def.cloneFromStrategyId ? await SmartOfferRule.findOne({ strategyId: def.cloneFromStrategyId }).lean() : null;
    const config = source || def;
    const basketCopy = def.cloneFromStrategyId ? renderBasketStrategyNotification(config) : null;
    
    let freeItem = null;
    if ([4, 6, 7, 14].includes(def.strategyId)) {
      freeItem = [4, 14].includes(def.strategyId) ? cachedDessertItem?._id || null : cachedDrinkItem?._id || null;
    }
    
    await SmartOfferRule.create({
      name: def.name,
      strategyId: def.strategyId,
      segment: config.segment,
      group: config.group,
      priority: config.priority,
      cooldownDays: config.cooldownDays,
      validityHours: config.validityHours,
      offerType: config.offerType,
      discountValue: config.discountValue,
      bonusThreshold: config.bonusThreshold,
      bonusPoints: config.bonusPoints || 0,
      discountSteps: config.discountSteps,
      followupValidityDays: config.followupValidityDays,
      triggerItem: config.triggerItem || null,
      triggerItemSize: config.triggerItemSize || "",
      giftItemSize: config.giftItemSize || "",
      targetCategory: config.targetCategory || null,
      targetMenuItem: config.targetMenuItem || null,
      useFavoriteCategory: Boolean(config.useFavoriteCategory),
      freeItem: config.freeItems?.length ? null : config.freeItem || freeItem,
      freeItems: config.freeItems || [],
      notificationTitle: basketCopy?.title || config.notificationTitle,
      notificationBody: basketCopy?.body || config.notificationBody,
      isActive: def.strategyId === 21 ? false : config.isActive !== false,
    });
    existingIds.add(def.strategyId);
    createdIds.push(def.strategyId);
  }
  return createdIds;
};

const initializeBasketStrategyRules = () => ensureSmartOfferRules({ strategyIds: new Set(BASKET_STRATEGY_BANDS.map((band) => band.strategyId)) });

const prepareDailyOffersJob = async (isManualTrigger = false) => {
  console.log("[prepareDailyOffersJob] Starting Smart Offers scan job...");
  const jobStart = Date.now();

  try {
    if (!isManualTrigger) {
      const cronStat = await SystemStat.findOne({ key: "smartOfferCronEnabled" }).lean();
      const cronEnabled = cronStat?.value !== undefined ? Boolean(cronStat.value) : true;
      if (!cronEnabled) {
        console.log("[prepareDailyOffersJob] ⏸️ Smart Offer Cron is currently DISABLED in settings. Skipping nightly scan.");
        return;
      }
    }
    
    const allCategories = await Category.find().lean();
    const allMenuItems = await MenuItem.find().lean();
    const availableMenuItems = allMenuItems.filter((item) => item.is_available);
    let allRules = await SmartOfferRule.find().lean();

    const cachedDessertItem = await findItemFromCategoryKeyword("dessert", allCategories, availableMenuItems);
    const cachedDrinkItem = await findItemFromCategoryKeyword("boisson", allCategories, availableMenuItems) || await findItemFromCategoryKeyword("drink", allCategories, availableMenuItems);
    const latestWaveReset = await SmartOfferWaveReset.findOne().sort({ createdAt: -1 }).lean();
    const cooldownResetAt = latestWaveReset?.createdAt || null;

    const menuItemToCategoryMap = {};
    allMenuItems.forEach(item => {
      menuItemToCategoryMap[String(item._id)] = item.category ? String(item.category._id || item.category) : null;
    });

    const date90dAgo = new Date(Date.now() - 90 * 86400000);
    const topItemDocs = await Order.aggregate([
      { $match: { createdAt: { $gte: date90dAgo }, status: { $nin: CANCELED_ORDER_STATUSES } } },
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

    const createdRuleIds = await ensureSmartOfferRules({ cachedDessertItem, cachedDrinkItem });
    if (createdRuleIds.length) {
      allRules = await SmartOfferRule.find().lean();
    }

    const ruleByStrategyId = {};
    for (const rule of allRules) {
      ruleByStrategyId[rule.strategyId] = rule;
    }

    const activeCampaigns = await Campaign.find({ isActive: true }).lean();
    const activeCampaignIds = activeCampaigns.map(c => c._id);
    const activeDynamicRules = await DynamicRule.find({ isActive: true, campaign: { $in: activeCampaignIds } }).populate("campaign").lean();

    activeDynamicRules.sort((a, b) => (b.weight || 0) - (a.weight || 0));

    let topCategoryForDiscovery = topCategoryDoc;
    if (!topCategoryForDiscovery) {
      const storedStat = await SystemStat.findOne({ key: "topCategory" }).lean();
      if (storedStat?.value) {
        topCategoryForDiscovery = allCategories.find(c => String(c._id) === String(storedStat.value._id)) || null;
      }
    }

    const userCursor = User.find({ isBanned: { $ne: true } })
      .select("_id name email expo_token appIsInstalled emailUnsubscribed createdAt")
      .lean()
      .cursor();

    const now = new Date();
    let batchBuffer = [];
    let totalProcessed = 0;
    let totalPrepared = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const processBatch = async (users) => {
      const userIds = users.map(u => u._id);

      // Trié du plus récent au plus ancien : RuleEvaluatorService.extractCriteriaValue("recency_days")
      // et le calcul du cooldown supposent que le premier élément par utilisateur est la commande la plus récente.
      const batchOrders = await Order.find({ user: { $in: userIds }, status: { $nin: CANCELED_ORDER_STATUSES } })
        .select("user createdAt sub_total total_price orderItems offers discount personalizedOffer")
        .sort({ createdAt: -1 })
        .lean();

      const ordersByUser = {};
      batchOrders.forEach(o => {
        const uid = String(o.user);
        if (!ordersByUser[uid]) ordersByUser[uid] = [];
        ordersByUser[uid].push(o);
      });

      const date90d = new Date(now.getTime() - 90 * 86400000);
      // Trié du plus récent au plus ancien : cooldownOffers[0] (plus bas) doit être la dernière offre reçue.
      const batchOffers = await PersonalizedOffer.find({ user: { $in: userIds }, createdAt: { $gte: date90d } })
        .sort({ createdAt: -1 })
        .lean();

      const offersByUser = {};
      batchOffers.forEach(o => {
        const uid = String(o.user);
        if (!offersByUser[uid]) offersByUser[uid] = [];
        offersByUser[uid].push(o);
      });

      const activeOffers = await PersonalizedOffer.find({
        user: { $in: userIds },
        $or: [
          { status: "prepared" },
          { status: { $in: ["active", "viewed", "clicked"] }, $or: [{ validUntil: { $gt: now } }, { validUntil: null }] },
        ],
      }).lean();

      const usersWithActiveOffer = new Set();
      const offersToExpire = [];

      activeOffers.forEach(offer => {
        const uid = String(offer.user);
        const orders = ordersByUser[uid] || [];
        const hasOrderedSince = orders.some(o => new Date(o.createdAt) > new Date(offer.createdAt));
        if (hasOrderedSince && !offer.isDeferredReward) {
          offersToExpire.push(offer._id);
        } else {
          usersWithActiveOffer.add(uid);
        }
      });

      if (offersToExpire.length > 0) {
        await PersonalizedOffer.updateMany({ _id: { $in: offersToExpire } }, { $set: { status: "expired" } });
      }

      const profileUpserts = [];
      const newOffersToInsert = [];

      for (const user of users) {
        try {
          const uid = String(user._id);
          const orders = ordersByUser[uid] || [];
          const userOffers = offersByUser[uid] || [];
          const cooldownOffers = cooldownResetAt ? userOffers.filter((offer) => new Date(offer.createdAt) >= cooldownResetAt) : userOffers;

          let preferredHour = 12;
          let preferredDay = 0;
          let lastOrderAt = null;
          const orderCount = orders.length;
          let recencyDays = 999;
          let ordersLast7d = 0;
          let ordersLast14d = 0;
          let ordersLast30d = 0;
          let ordersLast60d = 0;
          let ordersLast90d = 0;
          let averageBasketSize = 0;
          let avgBasket90d = 0;
          let rawAvgBasket90d = 0;
          let basketSizeStdDev = 0;
          let basketSizeStdDev90d = 0;
          let basketBand5Min = null;
          let medianOrderIntervalDays = null;
          const totals90d = [];
          const categoryShare90d = new Map();
          const categoryPurchaseCounts = new Map();

          if (orders.length > 0) {
            const hours = [];
            const days = [];
            const totals = [];
            const date7d = new Date(now.getTime() - 7 * 86400000);
            const date14d = new Date(now.getTime() - 14 * 86400000);
            const date30d = new Date(now.getTime() - 30 * 86400000);
            const date60d = new Date(now.getTime() - 60 * 86400000);

            const catCount90d = {};
            let totalItemsOrdered90d = 0;

            orders.forEach(o => {
              const parts = getPartsInTimezone(o.createdAt);
              const orderDate = new Date(o.createdAt);
              const purchasedItemIds = [
                ...(o.orderItems || []).map((item) => item.item),
                ...(o.offers || []).flatMap((offer) => (offer.items || []).map((item) => item.item)),
              ].filter(Boolean);
              
              hours.push(parts.hour);
              days.push(parts.day);
              
              if (orderDate >= date7d) ordersLast7d++;
              if (orderDate >= date14d) ordersLast14d++;
              if (orderDate >= date30d) ordersLast30d++;
              if (orderDate >= date60d) ordersLast60d++;
              if (orderDate >= date90d) {
                ordersLast90d++;
                if (o.sub_total != null && Number.isFinite(Number(o.sub_total))) totals90d.push(Math.max(0, Number(o.sub_total)));
                purchasedItemIds.forEach((itemId) => {
                    const categoryId = menuItemToCategoryMap[String(itemId)];
                    if (categoryId) {
                      categoryPurchaseCounts.set(categoryId, (categoryPurchaseCounts.get(categoryId) || 0) + 1);
                      catCount90d[categoryId] = (catCount90d[categoryId] || 0) + 1;
                      totalItemsOrdered90d++;
                    }
                });
              }
              if (orderDate < date90d) {
                purchasedItemIds.forEach((itemId) => {
                  const categoryId = menuItemToCategoryMap[String(itemId)];
                  if (categoryId) {
                    categoryPurchaseCounts.set(categoryId, (categoryPurchaseCounts.get(categoryId) || 0) + 1);
                  }
                });
              }
              if (o.sub_total != null && Number.isFinite(Number(o.sub_total))) totals.push(Math.max(0, Number(o.sub_total)));
              if (!lastOrderAt || o.createdAt > lastOrderAt) lastOrderAt = o.createdAt;
            });

            preferredHour = mode(hours) ?? 12;
            preferredDay = mode(days) ?? 0;
            recencyDays = Math.floor((now - new Date(lastOrderAt)) / 86400000);

            const sortedOrderDates = orders.map(o => new Date(o.createdAt).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
            const orderIntervalDays = [];
            for (let index = 1; index < sortedOrderDates.length; index++) {
              const intervalDays = (sortedOrderDates[index] - sortedOrderDates[index - 1]) / 86400000;
              if (intervalDays > 0) orderIntervalDays.push(intervalDays);
            }
            medianOrderIntervalDays = median(orderIntervalDays);

            const sum = totals.reduce((a, b) => a + b, 0);
            averageBasketSize = totals.length ? roundMoney(sum / totals.length, 0) : 0;
            if (totals.length > 1) {
              const variance = totals.reduce((a, b) => a + Math.pow(b - averageBasketSize, 2), 0) / (totals.length - 1);
              basketSizeStdDev = roundMoney(Math.sqrt(variance), 0);
            }

            if (totals90d.length > 0) {
              const sum90d = totals90d.reduce((a, b) => a + b, 0);
              rawAvgBasket90d = sum90d / totals90d.length;
              avgBasket90d = roundMoney(rawAvgBasket90d, 0);
              basketBand5Min = Math.min(75, Math.floor(rawAvgBasket90d / 5) * 5);
              if (totals90d.length > 1) {
                const variance90d = totals90d.reduce((sum, value) => sum + Math.pow(value - rawAvgBasket90d, 2), 0) / (totals90d.length - 1);
                basketSizeStdDev90d = roundMoney(Math.sqrt(variance90d), 0);
              }
            }

            if (totalItemsOrdered90d > 0) {
              Object.keys(catCount90d).forEach(cid => {
                categoryShare90d.set(cid, catCount90d[cid] / totalItemsOrdered90d);
              });
            }
          }

          const segment = determineSegment({ recencyDays, ordersLast7d, ordersLast14d, ordersLast30d, ordersLast60d });
          let favoriteCategory = null;
          let favoriteCategoryCount = 0;
          for (const [categoryId, count] of categoryPurchaseCounts.entries()) {
            if (count > favoriteCategoryCount) {
              favoriteCategoryCount = count;
              favoriteCategory = allCategories.find((category) => String(category._id) === String(categoryId)) || null;
            }
          }
          const reactivationProfiling = determineReactivationProfile({ orderCount, recencyDays, medianOrderIntervalDays });
          const basketStrategyId = totals90d.length >= 3 ? resolveBasketStrategyId(rawAvgBasket90d, (strategyId) => ruleByStrategyId[strategyId]?.isActive === true) : null;

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
                  ordersCount7d: ordersLast7d,
                  ordersCount14d: ordersLast14d,
                  ordersCount30d: ordersLast30d,
                  ordersCount60d: ordersLast60d,
                  averageBasketSize,
                  basketSizeStdDev,
                  ordersCount90d: ordersLast90d,
                  avgBasket90d,
                  basketSizeStdDev90d,
                  basketBand5Min,
                  basketStrategyId,
                  categoryShare90d,
                  medianOrderIntervalDays,
                  recencyToCadenceRatio: reactivationProfiling.recencyToCadenceRatio,
                  reactivationTriggerDay: reactivationProfiling.reactivationTriggerDay,
                  reactivationProfile: reactivationProfiling.reactivationProfile,
                  recommendedReactivationStrategyId: reactivationProfiling.recommendedReactivationStrategyId
                }
              },
              upsert: true,
            }
          });

          if (usersWithActiveOffer.has(uid)) {
            totalSkipped++;
            continue;
          }

          const isInCooldown = user.smartOfferCooldownEndsAt && new Date(user.smartOfferCooldownEndsAt) > now;

          if (isInCooldown) {
            totalSkipped++;
            continue;
          }

          const candidates = [];
          const accountCreatedAt = user.createdAt ? new Date(user.createdAt) : null;
          const accountAgeDays = (accountCreatedAt instanceof Date && Number.isFinite(accountCreatedAt.getTime())) ? (now.getTime() - accountCreatedAt.getTime()) / 86400000 : null;
          const openRate = 0; 

          const userStatsContext = {
             user, orders, preferredHour, preferredDay, segment, lastOrderAt, orderCount,
             ordersLast7d, ordersLast14d, ordersLast30d, ordersLast60d, ordersLast90d,
             averageBasketSize, basketSizeStdDev, avgBasket90d, basketSizeStdDev90d,
             medianOrderIntervalDays, categoryPurchaseCounts, favoriteCategory, accountAgeDays, openRate, userOffers
          };

          for (const rule of activeDynamicRules) {
             if (RuleEvaluatorService.evaluate(userStatsContext, rule)) {
                 const selectedOffer = await OfferDistributionService.selectOffer(userStatsContext, rule);
                 if (selectedOffer) {
                     candidates.push({ 
                       ...selectedOffer, 
                       score: rule.weight || 0, 
                       dynamicRuleId: rule._id, 
                       campaignId: rule.campaign?._id,
                       useFavoriteCategory: selectedOffer.useFavoriteCategory,
                       targetCategory: selectedOffer.targetCategory,
                       categoryName: selectedOffer.categoryName
                     });
                 }
             }
          }

          let filtered = candidates;
          filtered = filtered
            .filter((candidate) => !candidate.useFavoriteCategory || favoriteCategory)
            .map((candidate) => candidate.useFavoriteCategory ? { ...candidate, targetCategory: favoriteCategory._id, categoryName: favoriteCategory.name } : candidate);

          if (filtered.length === 0) {
            totalSkipped++;
            continue;
          }

          filtered.sort((a, b) => b.score - a.score);
          const selected = filtered[0];

          let notifyHour = preferredHour - 1;
          if (notifyHour < 8 || notifyHour > 21) notifyHour = 11;
          if (orderCount === 0) notifyHour = 13;
          
          if (selected.notifyAtHour !== undefined && selected.notifyAtHour !== null && selected.notifyAtHour !== "") {
            notifyHour = Number(selected.notifyAtHour);
          }
          
          let scheduledNotifyAt = getScheduledNotifyAt(now, notifyHour);
          let validFrom = null;

          if (selected.notifyOnDays && selected.notifyOnDays.length > 0) {
            const { day: today, hour: currentHour } = getPartsInTimezone(now);
            let daysToAdd = 7;

            for (const d of selected.notifyOnDays) {
              let diff = (d - today + 7) % 7;
              if (diff === 0 && currentHour >= notifyHour) {
                diff = 7;
              }
              if (diff < daysToAdd) daysToAdd = diff;
            }

            const nextDate = new Date(now.getTime() + daysToAdd * 86400000);
            scheduledNotifyAt = getTorontoWallClockUtc(nextDate, notifyHour);
            validFrom = getTorontoWallClockUtc(nextDate, 0);
          }

          const selectedCategory = selected.targetCategory ? allCategories.find((category) => String(category._id) === String(selected.targetCategory)) : null;
          const offerDetails = {
            categoryName: selected.categoryName || selectedCategory?.name || "",
            itemName: selected.itemName || "",
            discount: selected.discountValue ? (selected.offerType === "bonus_basket" ? `${selected.discountValue}$` : `${selected.discountValue}%`) : "",
            points: selected.bonusPoints || "",
            threshold: selected.bonusThreshold || "",
          };
          const finalTitle = personalizeText(selected.notificationTitle, user, offerDetails);
          const finalBody = personalizeText(selected.notificationBody, user, offerDetails);
          const selectedFreeItems = selected.freeItems || [];

          // Calcul de smartOfferCooldownEndsAt : date d'activation + durée + cooldown
          const validityHours = selected.validityHours || 24;
          const cooldownDays = selected.cooldownDays || selected.campaign?.defaultCooldownDays || 7;
          const smartOfferCooldownEndsAt = new Date(scheduledNotifyAt.getTime() + (validityHours * 3600000) + (cooldownDays * 86400000));

          newOffersToInsert.push({
            user: user._id,
            dynamicRule: selected.dynamicRuleId,
            campaign: selected.campaignId,
            offerConfigId: selected._id,
            rule: null, 
            status: "prepared",
            offerType: selected.offerType,
            discountValue: selected.discountValue || 0,
            bonusThreshold: selected.bonusThreshold || 0,
            bonusPoints: selected.bonusPoints,
            discountSteps: selected.discountSteps,
            followupValidityDays: selected.followupValidityDays,
            triggerItem: selected.triggerItem,
            triggerItemSize: selected.triggerItemSize,
            giftItemSize: selected.giftItemSize,
            targetCategory: selected.targetCategory || null,
            targetMenuItem: selected.targetMenuItem || null,
            freeItem: selectedFreeItems.length > 0 ? null : selected.freeItem || null,
            freeItems: selectedFreeItems,
            scheduledNotifyAt,
            validFrom,
            validityHours: selected.validityHours,
            notifyOnDays: selected.notifyOnDays || [],
            notifyAtHour: selected.notifyAtHour !== undefined ? selected.notifyAtHour : null,
            notificationTitle: finalTitle,
            notificationBody: finalBody,
            score: selected.score,
            strategyId: selected.strategyId || null,
            deferredThreshold: selected.deferredThreshold,
            deferredDiscountValue: selected.deferredDiscountValue,
            deferredValidityDays: selected.deferredValidityDays,
            deferredActivationRule: selected.deferredActivationRule,
            tieredDiscounts: selected.tieredDiscounts,
            mysteryThreshold: selected.mysteryThreshold,
            mysteryItemName: selected.mysteryItemName,
            smartOfferCooldownEndsAt // on l'ajoute provisoirement ici pour le récupérer après
          });

          totalPrepared++;
        } catch (userErr) {
          totalFailed++;
          console.error(`[prepareDailyOffersJob] Error processing user ${user._id}:`, userErr.message);
        }
      }

      if (profileUpserts.length > 0) {
        await UserSmartProfile.bulkWrite(profileUpserts, { ordered: false });
      }

      if (newOffersToInsert.length > 0) {
        // Extraire les dates de cooldown et retirer le champ temporaire avant l'insertion des offres
        const userCooldownUpdates = newOffersToInsert.map(offer => {
          const { smartOfferCooldownEndsAt, user } = offer;
          delete offer.smartOfferCooldownEndsAt;
          return {
            updateOne: {
              filter: { _id: user },
              update: { $set: { smartOfferCooldownEndsAt } }
            }
          };
        });

        await PersonalizedOffer.insertMany(newOffersToInsert, { ordered: false });
        
        if (userCooldownUpdates.length > 0) {
          await User.bulkWrite(userCooldownUpdates, { ordered: false });
        }
      }

      totalProcessed += users.length;
      console.log(`[prepareDailyOffersJob] Batch done — processed: ${totalProcessed}, prepared: ${totalPrepared}, skipped: ${totalSkipped}, failed: ${totalFailed}`);
    };

    for await (const user of userCursor) {
      batchBuffer.push(user);
      if (batchBuffer.length >= PREPARE_BATCH_SIZE) {
        await processBatch(batchBuffer);
        batchBuffer = [];
        await sleep(PREPARE_BATCH_DELAY);
      }
    }
    if (batchBuffer.length > 0) {
      await processBatch(batchBuffer);
    }

    const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
    console.log(`[prepareDailyOffersJob] ✅ Finished in ${elapsed}s — total: ${totalProcessed}, prepared: ${totalPrepared}, skipped: ${totalSkipped}, failed: ${totalFailed}`);
    if (totalFailed > 0) throw new Error(`${totalFailed} utilisateur(s) n'ont pas pu être traités pendant le scan Smart Offers.`);
  } catch (error) {
    console.error("[prepareDailyOffersJob] Fatal error:", error);
    if (isManualTrigger) throw error;
  }
};

module.exports = {
  getScheduledNotifyAt,
  getTorontoWallClockUtc,
  getPartsInTimezone,
  ensureSmartOfferRules,
  initializeBasketStrategyRules,
  getBasketStrategyBand,
  resolveBasketStrategyId,
  determineReactivationProfile,
  prepareDailyOffersJob,
};
