const ToppingCategory = require("../../models/ToppingCategory");

const deleteToppingCategoryService = async (id) => {
  try {
    const response = await ToppingCategory.findByIdAndDelete(id);
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  deleteToppingCategoryService,
};
