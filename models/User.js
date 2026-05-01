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
  firstOrderDiscountPromptDismissed: {
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
  birthdayDobPromptDismissed: {
    type: Boolean,
    default: false,
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
  subscriptionRenewalFailureInvoiceId: {
    type: String,
    default: null,
  },
  subscriptionRenewalFailureStartedAt: {
    type: Date,
    default: null,
  },
  subscriptionRenewalGraceEndsAt: {
    type: Date,
    default: null,
  },
  subscriptionRenewalFirstFailureEmailSentAt: {
    type: Date,
    default: null,
  },
  subscriptionSuspendedAt: {
    type: Date,
    default: null,
  },
  subscriptionSuspensionReason: {
    type: String,
    default: "",
  },
  subscriptionSuspensionEmailSentAt: {
    type: Date,
    default: null,
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  referralOrdersCount: {
    type: Number,
    default: 0,
  },
  referralBalance: {
    type: Number,
    default: 0,
  },
});

module.exports = model("User", userSchema);
