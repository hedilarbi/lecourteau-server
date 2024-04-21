const Restaurant = require("../../models/Restaurant");

const getRestaurantOrdersService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("orders")
      .populate("orders");
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantOrdersService,
};
