const { Schema, model } = require("mongoose");

const subscriptionPaymentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      default: "",
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      index: true,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      default: "",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "cad",
    },
    billingReason: {
      type: String,
      default: "subscription",
    },
    paymentType: {
      type: String,
      enum: ["activation", "renewal", "subscription"],
      default: "subscription",
    },
    paidAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    hediSharePercent: {
      type: Number,
      default: 10,
    },
    hediShareAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = model("SubscriptionPayment", subscriptionPaymentSchema);
