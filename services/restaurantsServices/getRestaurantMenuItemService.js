const Restaurant = require("../../models/Restaurant");

const getRestaurantMenuItemService = async (restaurantId, id) => {
  try {
    const restaurant = await Restaurant.findById(restaurantId)
      .select("menu_items")
      .populate({
        path: "menu_items",
        populate: {
          path: "menuItem",
          populate: [
            { path: "category" },
            { path: "customization", populate: { path: "category" } },
          ],
        },
      });

    // Check if restaurant exists
    if (!restaurant) {
      return { error: new Error("Restaurant not found") };
    }

    // Find the specific menu item within the restaurant's menu_items
    const menuItem = restaurant.menu_items.find(
      (item) => item.menuItem._id.toString() === id
    );

    if (!menuItem) {
      return { error: new Error("Menu item not found") };
    }

    return { response: menuItem };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantMenuItemService,
};
