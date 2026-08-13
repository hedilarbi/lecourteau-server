const { Schema, model } = require("mongoose");

const smartOfferRuleSchema = new Schema({
  strategyId: {
    type: Number,
    required: true,
  },
  segment: {
    type: String,
    enum: ["very_active", "normal", "inactive", "reactivate", "loyal"],
    required: true,
  },
  group: {
    type: String,
    enum: ["ACQUISITION", "HABITUDE", "REACTIVATION", "FIDELITE", "AFFINITE", "PANIER", "DECOUVERTE"],
    required: true,
  },
  priority: {
    type: Number,
    required: true,
    default: 50,
  },
  cooldownDays: {
    type: Number,
    required: true,
    default: 7,
  },
  validityHours: {
    type: Number,
    required: true,
    default: 24,
  },
  offerType: {
    type: String,
    enum: ["discount_category", "discount_product", "free_item", "bonus_basket", "discount_order", "free_delivery", "loyalty_points"],
    required: true,
  },
  discountValue: {
    type: Number, // Percentage (e.g. 15 for 15%) or flat amount (e.g. 5 for $5)
    default: 0,
  },
  bonusThreshold: {
    type: Number, // For bonus_basket (e.g. $20)
    default: 0,
  },
  bonusPoints: {
    type: Number,
    min: 0,
    default: 0,
  },
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
  notificationTitle: {
    type: String,
    required: true,
  },
  notificationBody: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

smartOfferRuleSchema.index({ strategyId: 1, segment: 1 }, { unique: true });

module.exports = model("SmartOfferRule", smartOfferRuleSchema);
