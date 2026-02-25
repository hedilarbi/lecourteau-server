const { Schema, model } = require("mongoose");

const subscriptionHediPayoutSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAt: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    createdByStaffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = model("SubscriptionHediPayout", subscriptionHediPayoutSchema);
