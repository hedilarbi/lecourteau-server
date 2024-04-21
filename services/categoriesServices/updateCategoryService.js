const Category = require("../../models/Category");

const updateCategoryService = async (id, name, firebaseUrl) => {
  try {
    let response;
    if (firebaseUrl) {
      response = await Category.findByIdAndUpdate(
        id,
        { name, image: firebaseUrl },
        { new: true }
      );
    } else {
      response = await Category.findByIdAndUpdate(id, { name }, { new: true });
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateCategoryService;
