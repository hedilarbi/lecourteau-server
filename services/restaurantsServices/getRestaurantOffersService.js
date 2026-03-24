const {
  getRestaurantOffersAvailabilityList,
} = require("./restaurantOfferAvailabilityService");

const getRestaurantOffersService = async (id) => {
  try {
    return await getRestaurantOffersAvailabilityList(id);
  } catch (error) {
    return { error: error?.message || error };
  }
};

module.exports = {
  getRestaurantOffersService,
};
