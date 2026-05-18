const Recipe = require("../../models/Recipe");

const createRecipeService = async (item, category, ingredients, instruction) => {
  try {
    const newRecipe = new Recipe({ item, category, ingredients, instruction });
    const savedRecipe = await newRecipe.save();
    const populated = await Recipe.findById(savedRecipe._id)
      .populate("item", "name image")
      .populate("category", "name");
    return { response: populated };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createRecipeService;
