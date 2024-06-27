const ToppingCategory = require("../../models/ToppingCategory");

const createToppingCategoryService = async (name) => {
  try {
    const toppingCategory = await ToppingCategory.findOne({ name });

    if (toppingCategory) {
      return { error: "categorie existe déjà" };
    }

    const newToppingCategory = new ToppingCategory({
      name,
    });

    const response = await newToppingCategory.save();

    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  createToppingCategoryService,
};
