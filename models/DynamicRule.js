const { Schema, model } = require("mongoose");

const offerConfigSchema = new Schema({
  offerType: {
    type: String,
    enum: [
      "bonus_basket",
      "discount_order",
      "discount_category",
      "discount_product",
      "free_item",
      "free_delivery",
      "loyalty_points",
      "split_discount",
      "buy_one_get_one",
      "deferred_cashback",
      "tiered_discount",
      "mystery_gift",
    ],
    required: true,
  },
  discountValue: { type: Number, default: 0 },
  bonusThreshold: { type: Number, default: 0 },
  bonusPoints: { type: Number, default: 0 },
  discountSteps: [Number],
  followupValidityDays: { type: Number, default: 7 },
  
  triggerItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
  triggerItemSize: String,
  giftItemSize: String,
  
  targetCategory: { type: Schema.Types.ObjectId, ref: "Category" },
  useFavoriteCategory: { type: Boolean, default: false },
  
  targetMenuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
  
  freeItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
  freeItems: [
    {
      item: { type: Schema.Types.ObjectId, ref: "MenuItem" },
      size: String,
    },
  ],

  notificationTitle: { type: String, required: true },
  notificationBody: { type: String, required: true },
  
  cooldownDays: { type: Number, default: 7 },
  validityHours: { type: Number, default: 48 },
  
  // Jours ciblés d'envoi (0=Dimanche, 1=Lundi, ..., 6=Samedi)
  notifyOnDays: { type: [Number], default: [] },
  
  // Heure ciblée d'envoi (0-23)
  notifyAtHour: { type: Number, default: null },

  // --- Nouveaux types gamifiés ---
  deferredThreshold: { type: Number },
  deferredDiscountValue: { type: Number },
  deferredValidityDays: { type: Number },
  deferredActivationRule: { type: String, default: 'immediate' },
  deferredTargetDay: { type: Number },
  
  tieredDiscounts: [
    {
      threshold: { type: Number },
      discountValue: { type: Number }
    }
  ],
  
  mysteryThreshold: { type: Number },
  mysteryItemName: { type: String },

  // --- Champs spécifiques aux méthodes de distribution ---
  
  // Pour "weighted_random"
  weight: { type: Number, default: 100 }, // ex: 75, 20, 5
  
  // Pour "waterfall"
  waterfallLevel: { type: Number, default: 1 }, // 1 = A, 2 = B, 3 = C
  waterfallDelayDays: { type: Number, default: 3 }, // Jours d'attente avant d'escalader

  // Pour "scenario_journey"
  stepId: { type: String }, // Identifiant unique local pour le graphe (généré par le front)
  nextStepOnAccept: { type: String }, // Réfère à un autre stepId
  nextStepOnIgnore: { type: String }, // Réfère à un autre stepId
  isRoot: { type: Boolean, default: false }, // Point de départ du scénario
});

const conditionSchema = new Schema({
  conditionId: { type: String, required: true }, // ex: "C1"
  criteria: {
    type: String,
    required: true,
    // Ex: "total_spent", "average_basket", "recency_days", "favorite_category", etc.
  },
  operator: {
    type: String,
    enum: [">", "<", ">=", "<=", "==", "!=", "in", "not_in"],
    required: true,
  },
  value: { type: Schema.Types.Mixed, required: true },
  periodDays: { type: Number, default: null }, // Null = all time, 30 = last 30 days
});

const dynamicRuleSchema = new Schema({
  campaign: {
    type: Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  logicalExpression: {
    type: String,
    required: true, // ex: "C1 AND C2 AND (C3 OR C4)"
  },
  conditions: [conditionSchema],
  distributionMethod: {
    type: String,
    enum: [
      "waterfall",
      "success_sequence", // Follow-up après utilisation
      "scenario_journey", // Graphe / Arbre de décision custom
      "weighted_random",
      "multi_armed_bandit",
      "fatigue_control",
      "engagement_split",
      "priority", // fallback/strict
    ],
    default: "priority",
  },
  weight: {
    type: Number,
    default: 0, // Plus le poids est élevé, plus la règle est prioritaire lors de l'évaluation
  },
  offers: [offerConfigSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

dynamicRuleSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = model("DynamicRule", dynamicRuleSchema);
