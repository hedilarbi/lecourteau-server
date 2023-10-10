const { Schema, model } = require("mongoose");

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
});

module.exports = model("User", userSchema);
