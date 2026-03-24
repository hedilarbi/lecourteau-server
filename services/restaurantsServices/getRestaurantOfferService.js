const {
  getRestaurantSingleOfferAvailability,
} = require("./restaurantOfferAvailabilityService");

const getRestaurantOfferService = async (restaurantId, id) => {
  try {
    return await getRestaurantSingleOfferAvailability(restaurantId, id);
  } catch (error) {
    console.error("Error in getRestaurantOfferService:", error);
    return { error: error?.message || error }; // Return error message
  }
};

module.exports = { getRestaurantOfferService };
