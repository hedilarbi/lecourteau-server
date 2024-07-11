const Category = require("../../models/Category");

const createCategoryService = async (name, firebaseUrl, customizationArray) => {
  try {
    const category = await Category.findOne({ name });
    if (category) {
      return { error: "categorie existe déja" };
    }
    const newCategory = new Category({
      name,
      image: firebaseUrl,
      customization: customizationArray,
    });
    const response = await newCategory.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createCategoryService;
