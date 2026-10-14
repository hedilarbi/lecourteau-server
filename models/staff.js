const mongoose = require("mongoose");
const { Schema } = mongoose;

const staffSchema = new Schema({
  username: String,
  name: String,
  // Jamais renvoyé par l'API : il faut le demander avec .select("+password").
  password: {
    type: String,
    select: false,
  },
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

staffSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.models.Staff || mongoose.model("Staff", staffSchema);
