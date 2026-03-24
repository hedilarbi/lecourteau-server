const {
  getRestaurantItemsAvailabilityList,
} = require("./restaurantMenuItemAvailabilityService");

const getRestaurantItemsService = async (id) => {
  try {
    return await getRestaurantItemsAvailabilityList(id);
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantItemsService,
};
