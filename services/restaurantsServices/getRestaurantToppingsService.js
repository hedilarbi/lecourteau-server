const {
  getRestaurantToppingsAvailabilityList,
} = require("./restaurantToppingAvailabilityService");

const getRestaurantToppingsService = async (id, options = {}) => {
  try {
    return await getRestaurantToppingsAvailabilityList(id, options);
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantToppingsService,
};
