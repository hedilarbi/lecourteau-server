const Recipe = require("../../models/Recipe");

const updateRecipeService = async (id, item, category, ingredients, instruction) => {
  try {
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return { error: "Recipe does not exist" };
    }
    const response = await Recipe.findByIdAndUpdate(
      id,
      { item, category, ingredients, instruction },
      { new: true }
    )
      .populate("item", "name image")
      .populate("category", "name");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateRecipeService;
