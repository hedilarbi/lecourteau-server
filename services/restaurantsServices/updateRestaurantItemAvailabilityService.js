const {
  toggleRestaurantMenuItemAvailability,
} = require("./restaurantMenuItemAvailabilityService");

const updateRestaurantItemAvailabilityService = async (id, itemId) => {
  try {
    return await toggleRestaurantMenuItemAvailability(id, itemId);
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateRestaurantItemAvailabilityService,
};
