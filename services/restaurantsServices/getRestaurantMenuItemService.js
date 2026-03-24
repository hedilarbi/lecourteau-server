const {
  getRestaurantSingleMenuItemAvailability,
} = require("./restaurantMenuItemAvailabilityService");

const getRestaurantMenuItemService = async (restaurantId, id) => {
  try {
    return await getRestaurantSingleMenuItemAvailability(restaurantId, id);
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantMenuItemService,
};
