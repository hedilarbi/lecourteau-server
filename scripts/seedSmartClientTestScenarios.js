require("dotenv").config();

const mongoose = require("mongoose");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const SmartClientRule = require("../modules/smart-client/smartClient.model");
const SmartClientRuleVersion = require("../modules/smart-client/smartClientRuleVersion.model");
const SmartClientService = require("../modules/smart-client/smartClient.service");

const PREFIX = "[TEST SMART CLIENT]";
const allDays = [0, 1, 2, 3, 4, 5, 6];

const conditionDefaults = () => ({
  operator: "AND",
  cart: {
    minTotal: 0,
    maxTotal: null,
    minItems: 0,
    missingCategories: [],
    requiredCategories: [],
    cartRatioVsHabit: "any",
    itemRemovedAfterTotal: false,
    sizeDowngraded: false,
  },
  behavior: {
    inactivitySeconds: 0,
    sessionDurationMin: 0,
    oscillationsMin: 0,
    cartCheckoutExit: false,
    promoCodeFailed: false,
  },
  context: {
    timeSlot: "all",
    customStartTime: "",
    customEndTime: "",
    daysOfWeek: [],
    orderType: "all",
    channel: "all",
    weather: "all",
  },
  rules: [],
});

const safeguards = (overrides = {}) => ({
  maxPerSession: 1,
  maxPerDay: 3,
  maxPerWeek: 7,
  delayAfterRefusal: 1,
  controlGroupPct: 0,
  triggerRate: 100,
  maxBudgetDaily: 100,
  maxBudgetTotal: 1000,
  maxDiscountPct: 25,
  startDate: new Date(Date.now() - 86400000),
  endDate: new Date(Date.now() + 180 * 86400000),
  priority: 50,
  ...overrides,
});

const offer = (mechanic, overrides = {}) => ({
  mechanic,
  targetType: "cart",
  thresholdType: "fixed",
  thresholdValue: 0,
  thresholdCeiling: 0,
  valueType: "discount_amount",
  value: 2,
  quantity: 1,
  currency: "cad",
  distribution: "single",
  variants: [],
  eligibleProductIds: [],
  excludedProductIds: [],
  ...overrides,
});

const scenario = (number, title, overrides) => ({
  track: overrides.track,
  ruleName: `${PREFIX} ${String(number).padStart(2, "0")} — ${title}`,
  triggerEvent: overrides.triggerEvent,
  selectedStates: overrides.selectedStates,
  conditions: { ...conditionDefaults(), ...(overrides.conditions || {}) },
  hasProfileFilter: Boolean(overrides.profileConditions?.rules?.length),
  profileConditions: overrides.profileConditions || { operator: "AND", rules: [] },
  offer: overrides.offer,
  location: overrides.location,
  validityDuration: overrides.validityDuration,
  showTimer: Boolean(overrides.showTimer),
  content: {
    title: `TEST ${number} — ${title}`.slice(0, 40),
    text: (overrides.text || "Scénario de validation Smart Client créé automatiquement.").slice(0, 90),
    buttonLabel: (overrides.buttonLabel || "Tester cette offre").slice(0, 80),
    image: "",
  },
  safeguards: safeguards(overrides.safeguards),
  status: "active",
});

async function buildScenarios() {
  const [items, categories] = await Promise.all([
    MenuItem.find({ is_available: { $ne: false } }).sort({ order: 1, _id: 1 }).limit(4).lean(),
    Category.find({}).sort({ order: 1, _id: 1 }).limit(4).lean(),
  ]);
  if (items.length < 2 || categories.length < 2) {
    throw new Error("Il faut au moins 2 articles et 2 catégories pour créer la matrice de test.");
  }
  const [itemA, itemB, itemC = itemA] = items;
  const [categoryA, categoryB] = categories;

  return [
    scenario(1, "Sauvetage après retrait", {
      track: "Persuasion", triggerEvent: "state_change", selectedStates: ["Sensible au prix"], location: "cart_banner", validityDuration: "15min", showTimer: true,
      conditions: { operator: "OR", cart: { ...conditionDefaults().cart, minTotal: 15, maxTotal: 80, minItems: 1, itemRemovedAfterTotal: true, cartRatioVsHabit: "below" } },
      offer: offer("rescue", { targetType: "removed_item", productId: itemA._id, thresholdType: "fixed", thresholdValue: 15, thresholdCeiling: 80, value: 2, distribution: "ab", variants: [{ key: "rabais_2", weight: 50, value: 2 }, { key: "rabais_3", weight: 50, value: 3 }] }),
      safeguards: { priority: 100, maxPerSession: 1, maxPerDay: 2, maxPerWeek: 3, delayAfterRefusal: 24, triggerRate: 100, controlGroupPct: 0, maxDiscountPct: 15 },
    }),
    scenario(2, "Prix fixe taille supérieure", {
      track: "Expansion", triggerEvent: "checkout_click", selectedStates: ["Décidé"], location: "cart_banner", validityDuration: "session",
      conditions: { cart: { ...conditionDefaults().cart, minItems: 1, sizeDowngraded: true }, context: { ...conditionDefaults().context, orderType: "pickup", channel: "app" } },
      profileConditions: { operator: "OR", rules: [{ field: "orderCount", operator: "gte", value: 1 }, { field: "favoriteCount", operator: "gt", value: 0 }] },
      offer: offer("fixed_price", { targetType: "size_upgrade", thresholdType: "cart_plus", thresholdValue: 0, valueType: "fixed_price", value: 3.99, distribution: "ai", variants: [{ key: "prix_399", weight: 60, value: 3.99 }, { key: "prix_499", weight: 40, value: 4.99 }] }),
      safeguards: { priority: 90, triggerRate: 90, controlGroupPct: 10 },
    }),
    scenario(3, "Cashback fidélité", {
      track: "Fidélisation", triggerEvent: "order_confirmed", selectedStates: ["Satisfait"], location: "confirmation", validityDuration: "7_days",
      profileConditions: { operator: "AND", rules: [{ field: "orderCount", operator: "gte", value: 3 }, { field: "fidelityPoints", operator: "lte", value: 1000 }] },
      offer: offer("cashback", { targetType: "cart", thresholdType: "habit_ratio", thresholdValue: 0, valueType: "cashback_amount", value: 5 }),
      safeguards: { priority: 40, maxPerWeek: 2, maxBudgetDaily: 50, maxBudgetTotal: 500 },
    }),
    scenario(4, "Rabais contexte livraison", {
      track: "Contexte", triggerEvent: "session_start", selectedStates: ["Neutre", "Indécis", "Sensible au prix"], location: "home", validityDuration: "24h", showTimer: true,
      conditions: { operator: "OR", cart: { ...conditionDefaults().cart, missingCategories: [String(categoryB._id)] }, context: { ...conditionDefaults().context, timeSlot: "afternoon", daysOfWeek: allDays, orderType: "delivery", channel: "app" } },
      offer: offer("discount", { targetType: "cart", thresholdType: "next_tier", thresholdValue: 0, thresholdCeiling: 100, valueType: "discount_pct", value: 10 }),
      safeguards: { priority: 60, triggerRate: 75, controlGroupPct: 20, maxDiscountPct: 10 },
    }),
    scenario(5, "Suggestion catégorie manquante", {
      track: "Mix produit", triggerEvent: "category_view", selectedStates: ["Indécis", "Explorateur"], location: "category", validityDuration: "weekend",
      conditions: { cart: { ...conditionDefaults().cart, missingCategories: [String(categoryA._id)] } },
      offer: offer("suggest_category", { targetType: "missing_role", categoryId: categoryA._id, thresholdType: "fixed", valueType: "category_id", value: 0 }),
      safeguards: { priority: 55, maxPerWeek: 5, maxDiscountPct: 0, maxBudgetDaily: null, maxBudgetTotal: null },
    }),
    scenario(6, "Assistance après inactivité", {
      track: "Service", triggerEvent: "inactivity", selectedStates: ["Frustré", "Sur le départ"], location: "cart_banner", validityDuration: "30min", showTimer: true,
      conditions: { operator: "OR", behavior: { ...conditionDefaults().behavior, inactivitySeconds: 30, sessionDurationMin: 2, oscillationsMin: 3, cartCheckoutExit: true, promoCodeFailed: true } },
      profileConditions: { operator: "OR", rules: [{ field: "subscriptionIsActive", operator: "eq", value: true }, { field: "hasDateOfBirth", operator: "neq", value: false }] },
      offer: offer("message_only", { targetType: "cart", valueType: "message", value: 0 }),
      text: "Besoin d’aide ? Vérifiez votre panier ou contactez-nous avant de continuer.", buttonLabel: "Voir mon panier",
      safeguards: { priority: 95, maxPerSession: 2, maxPerDay: 5, maxPerWeek: 10, maxDiscountPct: 0, maxBudgetDaily: null, maxBudgetTotal: null },
    }),
    scenario(7, "Article gratuit client réactivé", {
      track: "Réactivation", triggerEvent: "session_start", selectedStates: ["Neutre", "Sur le départ", "Pas le moment"], location: "in_app", validityDuration: "48h",
      profileConditions: { operator: "AND", rules: [{ field: "accountAgeDays", operator: "gte", value: 30 }, { field: "orderCount", operator: "lt", value: 20 }] },
      offer: offer("free_item", { targetType: "favorite_item", productId: itemA._id, thresholdType: "fixed", thresholdValue: 0, valueType: "item_id", value: 0, quantity: 1 }),
      safeguards: { priority: 70, maxPerWeek: 1, delayAfterRefusal: 72 },
    }),
    scenario(8, "Article offert au seuil", {
      track: "Expansion", triggerEvent: "cart_changed", selectedStates: ["Décidé", "Neutre"], location: "product", validityDuration: "10min", showTimer: true,
      conditions: { cart: { ...conditionDefaults().cart, minTotal: 30, minItems: 2, requiredCategories: [String(categoryA._id)] } },
      offer: offer("free_item_threshold", { targetType: "item", productId: itemB._id, thresholdType: "fixed", thresholdValue: 30, thresholdCeiling: 150, valueType: "item_id", value: 0 }),
      safeguards: { priority: 85, maxPerDay: 1, maxPerWeek: 2 },
    }),
    scenario(9, "BOGO après interaction", {
      track: "Persuasion", triggerEvent: "tappable_clicked", selectedStates: ["Sensible au prix", "Indécis"], location: "product", validityDuration: "10min", showTimer: true,
      conditions: { operator: "OR", rules: [{ field: "session.velocityScore", operator: "gte", value: 2 }, { field: "cart.lines", operator: "gte", value: 1 }] },
      profileConditions: { operator: "OR", rules: [{ field: "fidelityPoints", operator: "gt", value: 0 }, { field: "accountAgeDays", operator: "lte", value: 3650 }] },
      offer: offer("bogo", { targetType: "item", productId: itemC._id, categoryId: categoryB._id, thresholdType: "fixed", thresholdValue: 0, valueType: "discount_pct", value: 50, quantity: 2 }),
      safeguards: { priority: 80, triggerRate: 100, controlGroupPct: 0 },
    }),
    scenario(10, "Rabais sur catégorie", {
      track: "Contexte", triggerEvent: "cart_changed", selectedStates: ["Neutre", "Explorateur"], location: "category", validityDuration: "session",
      conditions: { cart: { ...conditionDefaults().cart, minItems: 1, requiredCategories: [String(categoryB._id)] } },
      offer: offer("discount", { targetType: "category", categoryId: categoryB._id, thresholdType: "fixed", thresholdValue: 0, valueType: "discount_amount", value: 1.5 }),
      safeguards: { priority: 45, maxPerSession: 1, maxPerDay: 2, maxPerWeek: 4 },
    }),
  ];
}

async function main() {
  if (!process.env.DEV_DB_CONNECTION) throw new Error("DEV_DB_CONNECTION est absent.");
  await mongoose.connect(process.env.DEV_DB_CONNECTION);
  const scenarios = await buildScenarios();
  const existing = await SmartClientRule.find({ ruleName: { $regex: `^\\${PREFIX}` } }).select("_id").lean();
  const existingIds = existing.map((rule) => rule._id);
  if (existingIds.length) await SmartClientRuleVersion.deleteMany({ rule: { $in: existingIds } });
  await SmartClientRule.deleteMany({ _id: { $in: existingIds } });

  const created = [];
  for (const payload of scenarios) {
    const rule = await SmartClientService.createRule(payload, {});
    created.push({ id: rule._id, name: rule.ruleName, trigger: rule.triggerEvent, mechanic: rule.offer.mechanic, status: rule.status });
  }
  console.log(JSON.stringify({ database: mongoose.connection.name, replaced: existingIds.length, created: created.length, rules: created }, null, 2));
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
