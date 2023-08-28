const { Schema, model } = require("mongoose");

const offerSchema = new Schema({
  name: String,
  image: String,
  items: [
    {
      item: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      quantity: Number,
      size: String,
    },
  ],
  price: Number,
  customizations: [
    {
      type: Schema.Types.ObjectId,
      ref: "Topping",
    },
  ],
  createdAt: Date,
  expireAt: Date,
});

module.exports = model("Offer", offerSchema);
