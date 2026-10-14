const { Schema, model } = require("mongoose");

const percent = { type: Number, min: 0, max: 100 };
const nonNegative = { type: Number, min: 0 };

const conditionRuleSchema = new Schema({
  field: { type: String, required: true, trim: true, maxlength: 120 },
  operator: { type: String, required: true, enum: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "exists"] },
  value: { type: Schema.Types.Mixed },
}, { _id: false, strict: true });

const conditionsSchema = new Schema({
  operator: { type: String, enum: ["AND", "OR"], default: "AND" },
  cart: {
    minTotal: nonNegative,
    maxTotal: { type: Number, min: 0, default: null },
    minItems: { type: Number, min: 0, default: 0 },
    missingCategories: [{ type: String, trim: true, maxlength: 100 }],
    requiredCategories: [{ type: String, trim: true, maxlength: 100 }],
    cartRatioVsHabit: { type: String, enum: ["any", "below", "equal", "above"], default: "any" },
    itemRemovedAfterTotal: { type: Boolean, default: false },
    sizeDowngraded: { type: Boolean, default: false },
  },
  behavior: {
    inactivitySeconds: nonNegative,
    sessionDurationMin: nonNegative,
    oscillationsMin: nonNegative,
    cartCheckoutExit: { type: Boolean, default: false },
    promoCodeFailed: { type: Boolean, default: false },
  },
  context: {
    timeSlot: { type: String, default: "all", maxlength: 40 },
    customStartTime: { type: String, default: "", maxlength: 5 },
    customEndTime: { type: String, default: "", maxlength: 5 },
    daysOfWeek: [{ type: String, maxlength: 12 }],
    orderType: { type: String, enum: ["all", "delivery", "pickup"], default: "all" },
    channel: { type: String, enum: ["all", "app", "web"], default: "all" },
    weather: { type: String, default: "all", maxlength: 40 },
  },
  rules: { type: [conditionRuleSchema], default: [] },
}, { _id: false, strict: true });

const profileConditionsSchema = new Schema({
  operator: { type: String, enum: ["AND", "OR"], default: "AND" },
  rules: { type: [conditionRuleSchema], default: [] },
}, { _id: false, strict: true });

const offerSchema = new Schema({
  mechanic: {
    type: String,
    required: true,
    enum: ["rescue", "fixed_price", "free_item_threshold", "cashback", "bogo", "message_only", "free_item", "add_item", "suggest_category", "discount"],
  },
  targetType: {
    type: String,
    enum: ["cart", "item", "category", "missing_role", "removed_item", "viewed_item", "favorite_item", "size_upgrade"],
    default: "cart",
  },
  productId: { type: Schema.Types.ObjectId, ref: "MenuItem", default: null },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  eligibleProductIds: [{ type: Schema.Types.ObjectId, ref: "MenuItem" }],
  excludedProductIds: [{ type: Schema.Types.ObjectId, ref: "MenuItem" }],
  thresholdType: { type: String, enum: ["fixed", "habit_ratio", "cart_plus", "next_tier"], default: "fixed" },
  thresholdValue: nonNegative,
  thresholdCeiling: nonNegative,
  valueType: { type: String, enum: ["discount_amount", "discount_pct", "fixed_price", "cashback_amount", "item_id", "category_id", "message"], default: "discount_amount" },
  value: nonNegative,
  quantity: { type: Number, min: 1, default: 1 },
  currency: { type: String, trim: true, lowercase: true, default: "cad", maxlength: 3 },
  distribution: { type: String, enum: ["single", "ai", "ab", "graph"], default: "single" },
  variants: [{
    key: { type: String, trim: true, maxlength: 80 },
    weight: percent,
    value: nonNegative,
    productId: { type: Schema.Types.ObjectId, ref: "MenuItem", default: null },
  }],
}, { _id: false, strict: true });

const smartClientRuleSchema = new Schema({
  schemaVersion: { type: Number, default: 2, min: 1 },
  version: { type: Number, default: 1, min: 1 },
  track: { type: String, required: true, trim: true, maxlength: 80 },
  ruleName: { type: String, required: true, trim: true, maxlength: 180 },
  triggerEvent: {
    type: String,
    required: true,
    enum: ["state_change", "checkout_click", "order_confirmed", "session_start", "category_view", "inactivity", "cart_changed", "tappable_clicked"],
  },
  selectedStates: [{
    type: String,
    enum: ["Neutre", "Indécis", "Sensible au prix", "Sur le départ", "Pas le moment", "Frustré", "Décidé", "Satisfait", "Explorateur"],
  }],
  conditions: { type: conditionsSchema, required: true, default: () => ({}) },
  hasProfileFilter: { type: Boolean, default: false },
  profileConditions: { type: profileConditionsSchema, default: () => ({}) },
  offer: { type: offerSchema, required: true },
  location: {
    type: String,
    required: true,
    enum: ["home", "category", "product", "cart_banner", "checkout", "confirmation", "in_app"],
    default: "checkout",
  },
  validityDuration: { type: String, enum: ["10min", "15min", "30min", "session", "24h", "48h", "7_days", "weekend"], default: "session" },
  showTimer: { type: Boolean, default: false },
  content: {
    title: { type: String, default: "", maxlength: 180 },
    text: { type: String, default: "", maxlength: 1000 },
    buttonLabel: { type: String, default: "Voir l'offre", maxlength: 80 },
    image: { type: String, default: "", maxlength: 2048 },
  },
  safeguards: {
    maxPerSession: { type: Number, min: 0, default: 1 },
    maxPerDay: { type: Number, min: 0, default: 2 },
    maxPerWeek: { type: Number, min: 0, default: 3 },
    delayAfterRefusal: { type: Number, min: 0, default: 24 },
    controlGroupPct: { ...percent, default: 10 },
    triggerRate: { ...percent, default: 100 },
    maxBudgetDaily: { type: Number, min: 0, default: null },
    maxBudgetTotal: { type: Number, min: 0, default: null },
    maxDiscountPct: { ...percent, default: 15 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    priority: { type: Number, min: 0, max: 1000, default: 50 },
  },
  status: { type: String, enum: ["draft", "test", "active", "inactive", "archived"], default: "draft" },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
}, { timestamps: true, strict: "throw", optimisticConcurrency: true });

smartClientRuleSchema.pre("validate", function validateRule(next) {
  const { startDate, endDate } = this.safeguards || {};
  if (startDate && endDate && startDate > endDate) return next(new Error("La date de fin doit suivre la date de début."));
  const { thresholdValue, thresholdCeiling } = this.offer || {};
  if (thresholdCeiling && thresholdValue && thresholdCeiling < thresholdValue) return next(new Error("Le plafond doit être supérieur au seuil."));
  const distribution = this.offer?.distribution;
  const variants = this.offer?.variants || [];
  if (distribution && distribution !== "single") {
    if (variants.length < 2) return next(new Error("Une distribution A/B ou automatique requiert au moins deux variantes."));
    const totalWeight = variants.reduce((sum, variant) => sum + Number(variant.weight || 0), 0);
    if (totalWeight !== 100) return next(new Error("Le poids total des variantes doit être égal à 100 %."));
  }
  if (["free_item", "free_item_threshold", "bogo"].includes(this.offer?.mechanic) && !this.offer?.productId) {
    return next(new Error("Cette mécanique requiert un article."));
  }
  if (this.offer?.mechanic === "suggest_category" && !this.offer?.categoryId) {
    return next(new Error("Cette mécanique requiert une catégorie."));
  }
  return next();
});

smartClientRuleSchema.index({ status: 1, "safeguards.priority": -1 });
smartClientRuleSchema.index({ location: 1, status: 1 });
smartClientRuleSchema.index({ triggerEvent: 1, status: 1 });

module.exports = model("SmartClientRule", smartClientRuleSchema);
