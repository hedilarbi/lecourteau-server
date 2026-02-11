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
});

module.exports = model("User", userSchema);
