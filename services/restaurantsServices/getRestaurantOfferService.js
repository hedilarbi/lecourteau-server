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
                path: "category",
                populate: { path: "customization", populate: "category" },
              },
            },
          },
        },
      });

    const response = restaurant.offers.filter((item) => item.offer._id == id);
    return { response: response[0] };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = { getRestaurantOfferService };
