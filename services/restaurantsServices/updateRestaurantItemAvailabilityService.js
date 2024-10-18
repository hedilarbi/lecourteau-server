const Restaurant = require("../../models/Restaurant");

const updateRestaurantItemAvailabilityService = async (id, itemId) => {
  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const menuItemIndex = restaurant.menu_items.findIndex(
      (item) => item.menuItem.toString() === itemId // Ensure to convert to string for comparison
    );

    if (menuItemIndex === -1) {
      return { error: "Item not found" };
    }

    // Toggle availability
    restaurant.menu_items[menuItemIndex].availability =
      !restaurant.menu_items[menuItemIndex].availability;

    const updatedRestaurant = await restaurant.save(); // Save and get the updated document
    return { status: "success", restaurant: updatedRestaurant }; // Optionally return the updated restaurant
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateRestaurantItemAvailabilityService,
};
