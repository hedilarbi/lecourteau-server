const { Schema, model } = require("mongoose");

const stateDefinitionSchema = new Schema(
  {
    stateId: {
      type: String,
      required: true,
      unique: true,
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
      cartInactivitySeconds: { type: Number, default: 30 },
      itemRemovedAfterTotal: { type: Boolean, default: true },
      sizeDowngraded: { type: Boolean, default: true },
      promosConsultationsCount: { type: Number, default: 2 },
      cartBelowHabitPct: { type: Number, default: 20 },
      failedSearchesCount: { type: Number, default: 2 },
      rapidClicksCount: { type: Number, default: 4 },
      promoCodeFailed: { type: Boolean, default: true },
      checkoutTimeSeconds: { type: Number, default: 25 },
      habitualItemsOnly: { type: Boolean, default: true },
      cartExitIntent: { type: Boolean, default: true },
    },
    naturalLanguageRule: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("SmartClientStateDefinition", stateDefinitionSchema);
