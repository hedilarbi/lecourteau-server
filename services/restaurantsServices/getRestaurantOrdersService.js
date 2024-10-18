const Restaurant = require("../../models/Restaurant");

const getRestaurantOrdersService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("orders")
      .populate("orders");

    // Check if the restaurant exists
    if (!response) {
      return { error: new Error("Restaurant not found") };
    }

    return { response }; // Return the response containing orders
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantOrdersService,
};
