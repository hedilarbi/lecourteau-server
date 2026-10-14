const { Schema, model } = require("mongoose");

const stateDefinitionSchema = new Schema(
  {
    stateId: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: "🤔",
    },
    questionLabel: {
      type: String,
      default: "", // ex: "Qu'est-ce qu'un client hésitant ?"
    },
    desc: {
      type: String,
      default: "",
    },
    criteria: {
      inactivitySeconds: { type: Number, default: 45 },
      oscillationsCount: { type: Number, default: 3 },
      optionsChangesCount: { type: Number, default: 3 },
      productViewWindowSeconds: { type: Number, default: 120 },
      distinctProductsViewedCount: { type: Number, default: 3 },
      productSwitchesCount: { type: Number, default: 3 },
      productRevisitsCount: { type: Number, default: 1 },
      cartInactivitySeconds: { type: Number, default: 30 },
      itemRemovedAfterTotal: { type: Boolean, default: true },
      sizeDowngraded: { type: Boolean, default: true },
      promosConsultationsCount: { type: Number, default: 2 },
      cartBelowHabitPct: { type: Number, default: 20 },
      freeDeliveryProximity: { type: Number, default: 10 },
      failedSearchesCount: { type: Number, default: 2 },
      rapidClicksCount: { type: Number, default: 4 },
      promoCodeFailed: { type: Boolean, default: true },
      checkoutTimeSeconds: { type: Number, default: 25 },
      habitualItemsOnly: { type: Boolean, default: true },
      cartExitIntent: { type: Boolean, default: true },
      screensVisitedCount: { type: Number, default: 6 },
    },
    naturalLanguageRule: {
      type: String,
      default: "",
    },
    priority: { type: Number, min: 0, max: 1000, default: 50 },
    enabled: { type: Boolean, default: true },
    minimumDurationSeconds: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true,
  }
);

stateDefinitionSchema.index({ stateId: 1 }, { unique: true });

module.exports = model("SmartClientStateDefinition", stateDefinitionSchema);
