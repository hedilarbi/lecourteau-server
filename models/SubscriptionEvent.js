const { Schema, model } = require("mongoose");

const subscriptionEventSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: "",
      index: true,
    },
    stripeInvoiceId: {
      type: String,
      default: "",
      index: true,
    },
    eventType: {
      type: String,
      enum: ["payment_failed", "suspended"],
      required: true,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reason: {
      type: String,
      default: "",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = model("SubscriptionEvent", subscriptionEventSchema);
