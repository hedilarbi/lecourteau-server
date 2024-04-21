const Restaurant = require("../../models/Restaurant");

const updateRestaurantToppingAvailabilityService = async (id, toppingId) => {
  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const menuItemIndex = restaurant.toppings.findIndex(
      (topping) => topping._id == toppingId
    );

    if (menuItemIndex === -1) {
      return { error: "Topping not found" };
    }

    restaurant.toppings[menuItemIndex].availability =
      !restaurant.toppings[menuItemIndex].availability;

    await restaurant.save();
    return { status: "success" };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateRestaurantToppingAvailabilityService,
};
