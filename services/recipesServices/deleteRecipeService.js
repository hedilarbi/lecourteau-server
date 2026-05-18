const Recipe = require("../../models/Recipe");

const deleteRecipeService = async (id) => {
  try {
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return { error: "Recipe does not exist" };
    }
    await Recipe.findByIdAndDelete(id);
    return {};
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteRecipeService;
