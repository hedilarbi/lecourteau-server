const { Schema, model } = require("mongoose");

const userSmartProfileSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true,
  },
  preferredHour: {
    type: Number,
    min: 0,
    max: 23,
    default: 12, // Default to lunchtime if not determined
  },
  preferredDay: {
    type: Number,
    min: 0,
    max: 6,
    default: 0, // Default to Sunday
  },
  segment: {
    type: String,
    enum: ["very_active", "normal", "inactive", "reactivate", "loyal"],
    default: "normal",
  },
  lastOrderAt: {
    type: Date,
    default: null,
  },
  orderCount: {
    type: Number,
    default: 0,
  },
  ordersCount7d: {
    type: Number,
    default: 0,
  },
  ordersCount14d: {
    type: Number,
    default: 0,
  },
  ordersCount30d: {
    type: Number,
    default: 0,
  },
  ordersCount60d: {
    type: Number,
    default: 0,
  },
  averageBasketSize: {
    type: Number,
    default: 0,
  },
  basketSizeStdDev: {
    type: Number,
    default: 0,
  },
  ordersCount90d: {
    type: Number,
    default: 0,
  },
  avgBasket90d: {
    type: Number,
    default: 0,
  },
  categoryShare90d: {
    type: Map,
    of: Number,
    default: {},
  },
  medianOrderIntervalDays: {
    type: Number,
    min: 0,
    default: null,
  },
  recencyToCadenceRatio: {
    type: Number,
    min: 0,
    default: null,
  },
  reactivationTriggerDay: {
    type: Number,
    min: 0,
    default: null,
  },
  reactivationProfile: {
    type: String,
    enum: ["early_risk", "early_abandonment", "sudden_stop", "low_frequency", "not_overdue"],
    default: null,
  },
  recommendedReactivationStrategyId: {
    type: Number,
    enum: [8, 9, 10, 11, 12, 19, 20],
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = model("UserSmartProfile", userSmartProfileSchema);
