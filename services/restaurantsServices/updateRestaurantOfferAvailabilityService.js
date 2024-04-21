const Restaurant = require("../../models/Restaurant");

const updateRestaurantOfferAvailabilityService = async (id, offerId) => {
  try {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const menuItemIndex = restaurant.offers.findIndex(
      (offer) => offer._id == offerId
    );

    if (menuItemIndex === -1) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    restaurant.offers[menuItemIndex].availability =
      !restaurant.offers[menuItemIndex].availability;

    await restaurant.save();
    return { status: "success" };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateRestaurantOfferAvailabilityService,
};
