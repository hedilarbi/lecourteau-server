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
            { path: "customization", populate: "category" },
            {
              path: "category",
              populate: { path: "customization", populate: "category" },
            },
          ],
        },
      });

    const response = restaurant.menu_items.filter(
      (item) => item.menuItem._id == id
    );
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getRestaurantMenuItemService,
};
