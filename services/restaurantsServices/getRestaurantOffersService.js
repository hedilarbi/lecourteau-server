const Restaurant = require("../../models/Restaurant");

const getRestaurantOffersService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("offers")
      .populate({ path: "offers", populate: "offer" });
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantOffersService,
};
