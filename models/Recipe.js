const { Schema, model } = require("mongoose");

const recipeSchema = new Schema({
  item: {
    type: Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  ingredients: [String],
  instruction: String,
});

module.exports = model("Recipe", recipeSchema);
