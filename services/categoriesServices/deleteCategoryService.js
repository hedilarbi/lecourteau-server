const { deleteImagesFromFirebase } = require("../../firebase");
const Category = require("../../models/Category");

const deleteCategoryService = async (id) => {
  try {
    const response = await Category.findById(id);
    if (!response) {
      return { error: "Category not found" };
    }
    await deleteImagesFromFirebase(response.image);
    await Category.findByIdAndDelete(id);
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteCategoryService;
