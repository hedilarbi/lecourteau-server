const { Schema, model } = require("mongoose");

const personalizedOfferSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rule: {
    type: Schema.Types.ObjectId,
    ref: "SmartOfferRule",
    required: true,
  },
  status: {
    type: String,
    enum: ["prepared", "active", "viewed", "clicked", "applied", "expired"],
    default: "prepared",
  },
  offerType: {
    type: String,
    enum: ["discount_category", "discount_product", "free_item", "bonus_basket", "discount_order", "free_delivery"],
    required: true,
  },
  discountValue: {
    type: Number,
    default: 0,
  },
  bonusThreshold: {
    type: Number,
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
  scheduledNotifyAt: {
    type: Date,
    required: true,
  },
  validFrom: {
    type: Date,
    default: null,
  },
  validUntil: {
    type: Date,
    default: null,
  },
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

module.exports = model("PersonalizedOffer", personalizedOfferSchema);
