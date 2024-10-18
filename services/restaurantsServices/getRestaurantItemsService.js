const Restaurant = require("../../models/Restaurant");
const getRestaurantItemsService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("menu_items")
      .populate({
        path: "menu_items",
        populate: { path: "menuItem", populate: "category" },
      });

    // Check if restaurant exists
    if (!response) {
      return { error: new Error("Restaurant not found") };
    }

    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantItemsService,
};
