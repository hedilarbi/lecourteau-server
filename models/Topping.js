const { Schema, model } = require("mongoose");

const toppingSchema = new Schema({
  name: String,
  image: String,
  price: Number,
  category: {
    type: Schema.Types.ObjectId,
    ref: "ToppingCategory",
  },
});

module.exports = model("Topping", toppingSchema);
