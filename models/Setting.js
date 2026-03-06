const { Schema, model } = require("mongoose");

const settingSchema = new Schema({
  working_hours: {
    open: {
      hours: String,
      minutes: String,
    },
    close: {
      hours: String,
      minutes: String,
    },
  },
  delivery: Boolean,
  open: Boolean,
  delivery_fee: Number,
  addresses: [
    {
      province: String,
      postal_code: String,
      city: String,
      street: String,
    },
  ],
  subscription: {
    monthlyPrice: {
      type: Number,
      default: 11.99,
    },
    freeItemMenuItemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      default: null,
    },
    freeItemMenuItemName: {
      type: String,
      default: "",
    },
    currency: {
      type: String,
      default: "cad",
    },
    stripeProductId: {
      type: String,
      default: "",
    },
    stripePriceId: {
      type: String,
      default: "",
    },
  },
  birthday: {
    freeItemMenuItemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      default: null,
    },
    freeItemMenuItemName: {
      type: String,
      default: "",
    },
  },
});

module.exports = model("Setting", settingSchema);
