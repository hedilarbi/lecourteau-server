const ToppingCategory = require("../../models/ToppingCategory");

const getToppingCategoryService = async (id) => {
  try {
    const response = await ToppingCategory.findById(id);
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getToppingCategoryService,
};
