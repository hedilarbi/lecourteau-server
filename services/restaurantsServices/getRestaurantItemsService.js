const {
  getRestaurantItemsAvailabilityList,
} = require("./restaurantMenuItemAvailabilityService");

const getRestaurantItemsService = async (id, options = {}) => {
  try {
    return await getRestaurantItemsAvailabilityList(id, options);
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantItemsService,
};
