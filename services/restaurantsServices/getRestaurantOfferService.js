const Restaurant = require("../../models/Restaurant");

const getRestaurantOfferService = async (restaurantId, id) => {
  try {
    const restaurant = await Restaurant.findById(restaurantId)
      .select("offers")
      .populate({
        path: "offers",
        populate: {
          path: "offer",
          populate: {
            path: "items",
            populate: {
              path: "item",
              populate: {
                path: "customization",
                populate: { path: "category" },
              },
            },
          },
        },
      });

    if (!restaurant) {
      return { error: new Error("Restaurant not found") };
    }

    // Find the specific offer by ID
    const offer = restaurant.offers.find(
      (item) => item.offer._id.toString() === id
    );

    return { response: offer || null }; // Return null if not found
  } catch (error) {
    console.error("Error in getRestaurantOfferService:", error);
    return { error: error.message }; // Return error message
  }
};

module.exports = { getRestaurantOfferService };
