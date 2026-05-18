const Recipe = require("../../models/Recipe");

const getRecipesService = async () => {
  try {
    const response = await Recipe.find()
      .populate("item", "name image")
      .populate("category", "name");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getRecipesService;
