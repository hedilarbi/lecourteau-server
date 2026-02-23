const { Schema, model } = require("mongoose");

const subscriptionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripePriceId: {
      type: String,
    },
    status: {
      type: String,
      default: "inactive",
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    monthlyPrice: {
      type: Number,
      default: 11.99,
    },
    currency: {
      type: String,
      default: "cad",
    },
    freeItemCycleKey: {
      type: String,
      default: "",
    },
    freeItemUsedCount: {
      type: Number,
      default: 0,
    },
    savingsTotal: {
      type: Number,
      default: 0,
    },
    lastStripePayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = model("Subscription", subscriptionSchema);
