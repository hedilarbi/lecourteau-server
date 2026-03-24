const {
  toggleRestaurantOfferAvailability,
} = require("./restaurantOfferAvailabilityService");

const updateRestaurantOfferAvailabilityService = async (id, offerId) => {
  try {
    return await toggleRestaurantOfferAvailability(id, offerId);
  } catch (error) {
    return { error: error?.message || error }; // Return error message for handling
  }
};

module.exports = {
  updateRestaurantOfferAvailabilityService,
};
