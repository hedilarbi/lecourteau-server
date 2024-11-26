const { Schema, model } = require("mongoose");

const restaurantSchema = new Schema({
  name: String,
  address: String,
  location: {
    longitude: Number,
    latitude: Number,
  },
  phone_number: String,
  orders: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  menu_items: [
    {
      menuItem: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      availability: {
        type: Boolean,
        default: true,
      },
    },
  ],
  toppings: [
    {
      topping: {
        type: Schema.Types.ObjectId,
        ref: "Topping",
      },
      availability: {
        type: Boolean,
        default: true,
      },
    },
  ],
  offers: [
    {
      offer: {
        type: Schema.Types.ObjectId,
        ref: "Offer",
      },
      availability: {
        type: Boolean,
        default: true,
      },
    },
  ],
  staff: [
    {
      employee: {
        type: Schema.Types.ObjectId,
        ref: "Staff",
      },
    },
  ],
  expo_token: String,
  settings: {
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
  },
});

module.exports = model("Restaurant", restaurantSchema);
