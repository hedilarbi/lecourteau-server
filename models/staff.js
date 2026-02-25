const mongoose = require("mongoose");
const { Schema } = mongoose;

const staffSchema = new Schema({
  username: String,
  name: String,
  password: String,
  createdAt: Date,
  role: String,
  image: String,
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
  },
  expo_token: String,
  orders: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  is_available: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.models.Staff || mongoose.model("Staff", staffSchema);
