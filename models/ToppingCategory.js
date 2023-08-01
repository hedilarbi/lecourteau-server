const { Schema, model } = require("mongoose");

const toppingCategorySchema = new Schema({
  name: String,
});

module.exports = model("ToppingCategory", toppingCategorySchema);
