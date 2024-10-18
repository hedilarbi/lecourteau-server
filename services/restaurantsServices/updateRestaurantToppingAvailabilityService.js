const Restaurant = require("../../models/Restaurant");

const updateRestaurantToppingAvailabilityService = async (id, toppingId) => {
  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return { error: "Restaurant not found" }; // Return error
    }

    const toppingIndex = restaurant.toppings.findIndex(
      (topping) => topping._id.toString() === toppingId // Convert ObjectId to string for comparison
    );

    if (toppingIndex === -1) {
      return { error: "Topping not found" }; // Return error
    }

    // Toggle availability
    restaurant.toppings[toppingIndex].availability =
      !restaurant.toppings[toppingIndex].availability;

    await restaurant.save();
    return { status: "success" }; // Indicate success
  } catch (error) {
    return { error: error.message }; // Return error message
  }
};

module.exports = {
  updateRestaurantToppingAvailabilityService,
};
