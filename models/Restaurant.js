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
});

module.exports = model("Restaurant", restaurantSchema);
