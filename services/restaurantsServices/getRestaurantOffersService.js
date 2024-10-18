const Restaurant = require("../../models/Restaurant");

const getRestaurantOffersService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("offers")
      .populate({ path: "offers", populate: "offer" });

    // Check if the restaurant exists
    if (!response) {
      return { error: new Error("Restaurant not found") };
    }

    return { response }; // Return the response containing offers
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantOffersService,
};
