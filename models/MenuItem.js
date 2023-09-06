const { Schema, model } = require("mongoose");

const menuItemSchema = new Schema({
  name: String,
  image: String,
  prices: [
    {
      size: String,
      price: Number,
    },
  ],
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
  },
  description: String,
  components: [String],
  customization: [
    {
      type: Schema.Types.ObjectId,
      ref: "Topping",
    },
  ],
  is_available: {
    type: Schema.Types.Boolean,
    default: true,
  },
});

module.exports = model("MenuItem", menuItemSchema);
