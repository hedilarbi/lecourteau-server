const Restaurant = require("../../models/Restaurant");

const updateRestaurantItemAvailabilityService = async (id, itemId) => {
  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const menuItemIndex = restaurant.menu_items.findIndex(
      (item) => item._id == itemId
    );

    if (menuItemIndex === -1) {
      return { error: "Item not found" };
    }

    restaurant.menu_items[menuItemIndex].availability =
      !restaurant.menu_items[menuItemIndex].availability;

    await restaurant.save();
    return { status: "success" };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateRestaurantItemAvailabilityService,
};
