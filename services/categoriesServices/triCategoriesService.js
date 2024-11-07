const Category = require("../../models/Category");

const triCategoriesService = async (list) => {
  try {
    const categories = await Category.find();

    // Collect promises for saving the updated items
    const savePromises = list.map(async (item) => {
      const category = categories.find((cat) => cat._id.toString() === item.id);
      if (!category) {
        return { error: `Item with ID ${item.id} not found` }; // Return error if item not found
      }
      category.order = item.order;
      return category.save(); // Return the save promise
    });

    // Execute all save promises
    await Promise.all(savePromises);

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = triCategoriesService;
