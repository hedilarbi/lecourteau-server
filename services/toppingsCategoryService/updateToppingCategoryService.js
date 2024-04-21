const ToppingCategory = require("../../models/ToppingCategory");

const updateToppingCategoryService = async (id, name) => {
  try {
    const response = await ToppingCategory.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateToppingCategoryService,
};
