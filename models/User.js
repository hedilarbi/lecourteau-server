const { Schema, model } = require("mongoose");
const PromoCode = require("./PromoCode");

const userSchema = new Schema({
  name: String,
  email: String,
  phone_number: String,
  date_of_birth: Date,
  addresses: [
    {
      address: String,
      coords: {
        latitude: Number,
        longitude: Number,
      },
      street_address: String,
      city: String,
      state: String,
      postal_code: String,
      country: String,
    },
  ],
  orders: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  favorites: [
    {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
    },
  ],
  fidelity_points: {
    type: Number,
    default: 0,
  },
  createdAt: Date,
  is_profile_setup: {
    type: Boolean,
    default: false,
  },
  expo_token: String,
  auth_mehtod: String,
  firstOrderDiscountApplied: {
    type: Boolean,
    default: false,
  },
  stripe_id: String,
  subscriptionIsActive: {
    type: Boolean,
    default: false,
  },
  subscriptionStatus: {
    type: String,
    default: "inactive",
  },
  subscriptionAutoRenew: {
    type: Boolean,
    default: false,
  },
  subscriptionStripeSubscriptionId: {
    type: String,
    default: null,
  },
  subscriptionCurrentPeriodStart: {
    type: Date,
    default: null,
  },
  subscriptionCurrentPeriodEnd: {
    type: Date,
    default: null,
  },
  subscriptionMonthlyPrice: {
    type: Number,
    default: 11.99,
  },
  subscriptionFreeItemCycleKey: {
    type: String,
    default: "",
  },
  subscriptionFreeItemUsedCount: {
    type: Number,
    default: 0,
  },
  birthdayFreeItemCycleYear: {
    type: Number,
    default: 0,
  },
  birthdayFreeItemUsedCount: {
    type: Number,
    default: 0,
  },
  birthdayLastNotificationYear: {
    type: Number,
    default: 0,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  usedPromoCodes: [
    {
      promoCode: {
        type: Schema.Types.ObjectId,
        ref: "PromoCode",
      },
      numberOfUses: {
        type: Number,
      },
    },
  ],
  subscriptionSavingsTotal: {
    type: Number,
    default: 0,
  },
  subscriptionAmountPaidTotal: {
    type: Number,
    default: 0,
  },
  subscriptionPaymentsCount: {
    type: Number,
    default: 0,
  },
});

module.exports = model("User", userSchema);
