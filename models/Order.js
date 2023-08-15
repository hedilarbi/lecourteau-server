const { Schema, model } = require("mongoose");

const orderSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  orderItems: [
    {
      item_id: {
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
  total_price: Number,
  sub_total: Number,
  delivery_fee: Number,
  instructions: String,
  type: String,
  address: {
    latitude: Number,
    longitude: Number,
  },
  status: String,
  createdAt: Date,
});

module.exports = model("Order", orderSchema);
