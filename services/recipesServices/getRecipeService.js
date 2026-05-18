const Recipe = require("../../models/Recipe");

const getRecipeService = async (id) => {
  try {
    const response = await Recipe.findById(id)
      .populate("item", "name image")
      .populate("category", "name");
    if (!response) {
      return { error: "Recipe not found" };
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getRecipeService;
