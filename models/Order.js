const { Schema, model } = require("mongoose");

const orderSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  orderItems: [
    {
      item: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      customizations: [
        {
          type: Schema.Types.ObjectId,
          ref: "Topping",
        },
      ],
      size: String,
      price: Number,
    },
  ],
  offers: [
    {
      type: Schema.Types.ObjectId,
      ref: "Offer",
    },
  ],
  rewards: [
    {
      type: Schema.Types.ObjectId,
      ref: "Reward",
    },
  ],
  total_price: Number,
  sub_total: Number,
  delivery_fee: Number,
  instructions: String,
  type: String,
  coords: {
    latitude: Number,
    longitude: Number,
  },
  address: String,
  status: String,
  createdAt: Date,
});

module.exports = model("Order", orderSchema);
