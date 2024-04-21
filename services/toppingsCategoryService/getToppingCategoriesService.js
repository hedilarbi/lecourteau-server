const ToppingCategory = require("../../models/ToppingCategory");

const getToppingCategoriesService = async () => {
  try {
    const response = await ToppingCategory.find();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getToppingCategoriesService,
};
