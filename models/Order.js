const { Schema, model } = require("mongoose");
const PromoCode = require("./PromoCode");

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
      comment: String,
    },
  ],
  offers: [
    {
      offer: {
        type: Schema.Types.ObjectId,
        ref: "Offer",
      },
      items: [
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
        },
      ],
      price: Number,
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
  code: String,
  review: {
    comment: String,
    rating: Number,
    status: {
      type: Boolean,
      default: false,
    },
  },
  delivery_by: {
    type: Schema.Types.ObjectId,
    ref: "Staff",
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
  },
  discount: Number,
  sub_total_after_discount: Number,
  tip: Number,
  confirmed: {
    type: Boolean,
    default: false,
  },
  paymentIntentId: String,
  payment_method: {
    type: String,
    default: "cash",
  },
  payment_status: {
    type: Boolean,
    default: false,
  },
  promoCode: {
    type: Schema.Types.ObjectId,
    ref: "PromoCode",
  },
});

module.exports = model("Order", orderSchema);
