const {
  toggleRestaurantToppingAvailability,
} = require("./restaurantToppingAvailabilityService");

const updateRestaurantToppingAvailabilityService = async (id, toppingId) => {
  try {
    return await toggleRestaurantToppingAvailability(id, toppingId);
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateRestaurantToppingAvailabilityService,
};
