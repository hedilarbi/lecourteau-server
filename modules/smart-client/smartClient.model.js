const { Schema, model } = require("mongoose");

const smartClientRuleSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    weight: {
      type: Number,
      required: true,
      default: 50,
    },
    tags: {
      type: [String],
      default: [],
    },
    conditions: {
      // Flexible Schema for the conditions builder
      type: Schema.Types.Mixed,
      required: true,
      default: {
        operator: "AND",
        rules: [],
      },
    },
    location: {
      type: [String],
      required: true,
      default: ["everywhere"],
    },
    offers: {
      distributionMethod: {
        type: String,
        enum: ["weighted", "ai"],
        required: true,
        default: "weighted",
      },
      assignedOffers: [
        {
          id: { type: String, required: true }, // Store as string to handle PromoCode string ID or ObjectId
          name: { type: String },
          weight: { type: Number, default: 0 },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// We could add indexes here in the future if we need to query by specific locations or tags frequently
smartClientRuleSchema.index({ isActive: 1, weight: -1 });

module.exports = model("SmartClientRule", smartClientRuleSchema);
