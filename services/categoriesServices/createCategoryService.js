const Category = require("../../models/Category");

const createCategoryService = async (name, firebaseUrl) => {
  try {
    const existingCategory = await Category.findOne({ name });

    if (existingCategory) {
      return { error: "Category already exists" };
    }

    const newCategory = new Category({
      name,
      image: firebaseUrl,
    });

    const savedCategory = await newCategory.save();
    return { response: savedCategory };
  } catch (err) {
    console.error("Error saving category:", err);
    return { error: "An error occurred while saving the category." };
  }
};

module.exports = createCategoryService;
