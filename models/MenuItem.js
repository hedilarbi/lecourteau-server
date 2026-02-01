const { Schema, model } = require("mongoose");

const menuItemSchema = new Schema({
  name: String,
  slug: String,
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
  customization_group: {
    type: Schema.Types.ObjectId,
    ref: "ToppingGroup",
  },

  is_available: {
    type: Schema.Types.Boolean,
    default: true,
  },
  order: Number,
});

module.exports = model("MenuItem", menuItemSchema);
