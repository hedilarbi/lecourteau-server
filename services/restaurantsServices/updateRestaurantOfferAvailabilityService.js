const Restaurant = require("../../models/Restaurant");

const updateRestaurantOfferAvailabilityService = async (id, offerId) => {
  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return { error: "Restaurant not found" }; // Return error instead of responding directly
    }

    const offerIndex = restaurant.offers.findIndex(
      (offer) => offer._id.toString() === offerId // Ensure to convert to string for comparison
    );

    if (offerIndex === -1) {
      return { error: "Offer not found" }; // Return error instead of responding directly
    }

    // Toggle availability
    restaurant.offers[offerIndex].availability =
      !restaurant.offers[offerIndex].availability;

    await restaurant.save();
    return { status: "success" }; // Indicate success
  } catch (error) {
    return { error: error.message }; // Return error message for handling
  }
};

module.exports = {
  updateRestaurantOfferAvailabilityService,
};
