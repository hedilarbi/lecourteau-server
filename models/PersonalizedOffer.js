const { Schema, model } = require("mongoose");

const personalizedOfferSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // V1 (SmartOfferRule) retiré du système : `rule` n'est plus renseigné pour les offres créées
  // depuis V2 (elles utilisent `dynamicRule`/`campaign` ci-dessous à la place). Il reste dans le
  // schéma pour les documents V1 historiques, mais n'est plus required.
  rule: {
    type: Schema.Types.ObjectId,
    ref: "SmartOfferRule",
    default: null,
  },
  dynamicRule: {
    type: Schema.Types.ObjectId,
    ref: "DynamicRule",
    default: null,
  },
  campaign: {
    type: Schema.Types.ObjectId,
    ref: "Campaign",
    default: null,
  },
  // Id du sous-document offers[] (dans DynamicRule) qui a été sélectionné — nécessaire pour que
  // OfferDistributionService retrouve la config exacte lors des évaluations suivantes
  // (waterfall/success_sequence/fatigue_control/multi_armed_bandit interrogent ce champ).
  offerConfigId: {
    type: Schema.Types.ObjectId,
    default: null,
  },
  // Récompense d'un cashback différé : offre deferred_cashback qui l'a générée (anti-doublon).
  deferredSourceOffer: { type: Schema.Types.ObjectId, ref: "PersonalizedOffer", default: null },
  isDeferredReward: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    // "expired" = la fenêtre de validité s'est écoulée sans qu'aucune commande n'arrive.
    // "ignored" = le client a passé/confirmé une commande sans utiliser cette offre active (R15).
    // replaced : offre en attente d'activation remplacée ou annulée après une commande (jamais envoyée).
    enum: ["prepared", "active", "viewed", "clicked", "applied", "expired", "ignored", "replaced"],
    default: "prepared",
  },
  offerType: {
    type: String,
    enum: [
      "discount_category", "discount_product", "free_item", "bonus_basket", "discount_order",
      "free_delivery", "loyalty_points", "split_discount", "buy_one_get_one",
      // Types V2 uniquement (voir DynamicRule.offers[].offerType) :
      "deferred_cashback", "tiered_discount", "mystery_gift",
    ],
    required: true,
  },
  // Ciblage jour/heure d'envoi (copié depuis DynamicRule.offers[] au moment de la sélection).
  notifyOnDays: { type: [Number], default: [] },
  notifyAtHour: { type: Number, default: null },
  // Champs spécifiques aux types gamifiés V2 (deferred_cashback / tiered_discount / mystery_gift).
  // NOTE : deferred_cashback n'a pas encore de logique de consommation dans createOrderService.js
  // (contrairement à tiered_discount et mystery_gift, déjà gérés) — ces champs sont déclarés pour
  // que l'offre se sauvegarde correctement, mais son application à la commande reste à implémenter.
  deferredThreshold: { type: Number, default: null },
  deferredDiscountValue: { type: Number, default: null },
  deferredValidityDays: { type: Number, default: null },
  deferredActivationRule: { type: String, default: null },
  tieredDiscounts: [
    {
      threshold: { type: Number },
      discountValue: { type: Number },
    },
  ],
  mysteryThreshold: { type: Number, default: null },
  mysteryItemName: { type: String, default: null },
  discountValue: {
    type: Number,
    default: 0,
  },
  bonusThreshold: {
    type: Number,
    default: 0,
  },
  bonusPoints: {
    type: Number,
    min: 0,
    default: 0,
  },
  discountSteps: { type: [Number], default: undefined },
  currentStep: { type: Number, min: 0, default: 0 },
  followupValidityDays: { type: Number, min: 1, default: 7 },
  // Rabais globaux (discount_order, split_discount, bonus_basket) : les articles de ces
  // catégories ne sont pas remisés. Panier 100 % exclu → aucun rabais.
  excludedCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  firstAppliedAt: { type: Date, default: null },
  triggerItem: { type: Schema.Types.ObjectId, ref: "MenuItem", default: null },
  triggerItemSize: { type: String, default: "" },
  giftItemSize: { type: String, default: "" },
  targetCategory: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  targetMenuItem: {
    type: Schema.Types.ObjectId,
    ref: "MenuItem",
    default: null,
  },
  freeItem: {
    type: Schema.Types.ObjectId,
    ref: "MenuItem",
    default: null,
  },
  freeItems: [
    {
      item: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      size: {
        type: String,
        required: true,
      },
    },
  ],
  scheduledNotifyAt: {
    type: Date,
    required: true,
  },
  validityHours: {
    type: Number,
    min: 1,
  },
  validFrom: {
    type: Date,
    default: null,
  },
  validUntil: {
    type: Date,
    default: null,
  },
  initialNotificationSentAt: {
    type: Date,
    default: null,
  },
  reminderClaimedAt: {
    type: Date,
    default: null,
  },
  reminderSentAt: {
    type: Date,
    default: null,
  },
  reminderSkippedAt: {
    type: Date,
    default: null,
  },
  reminderAttemptCount: {
    type: Number,
    min: 0,
    default: 0,
  },
  // Rabais divisé : dernière étape pour laquelle la notification "prochain rabais prêt" /
  // le rappel "dernier jour" ont été envoyés (anti-doublon, voir SplitDiscountNotificationService).
  splitStepNotifiedFor: { type: Number, default: null },
  splitExpiryReminderFor: { type: Number, default: null },
  notificationTitle: {
    type: String,
    required: true,
  },
  notificationBody: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    default: 0,
  },
  strategyId: {
    type: Number,
    default: null,
  },
  notifClicked: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

personalizedOfferSchema.index({ status: 1, scheduledNotifyAt: 1 });

module.exports = model("PersonalizedOffer", personalizedOfferSchema);
