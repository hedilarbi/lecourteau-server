const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  name: String,
  email: String,
  phone_number: String,
  addresses: [
    {
      region: String,
      city: String,
      street: String,
      number: String,
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
});

module.exports = model("User", userSchema);
