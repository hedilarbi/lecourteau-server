const Category = require("../../models/Category");

const updateCategoryService = async (
  id,
  name,
  firebaseUrl,
  newCustomization
) => {
  try {
    let response;
    if (firebaseUrl) {
      response = await Category.findByIdAndUpdate(
        id,
        { name, image: firebaseUrl, customization: newCustomization },
        { new: true }
      );
    } else {
      response = await Category.findByIdAndUpdate(
        id,
        { name, customization: newCustomization },
        { new: true }
      );
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateCategoryService;
