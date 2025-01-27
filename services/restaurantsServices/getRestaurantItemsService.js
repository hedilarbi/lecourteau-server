const Restaurant = require("../../models/Restaurant");
const getRestaurantItemsService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("menu_items")
      .populate({
        path: "menu_items",
        populate: { path: "menuItem", populate: "category" },
      });

    if (!response) {
      return { error: new Error("Restaurant not found") };
    }
    response.menu_items.sort((a, b) => a.menuItem.order - b.menuItem.order);

    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantItemsService,
};
