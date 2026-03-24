const Restaurant = require("../../models/Restaurant");
const Order = require("../../models/Order");

const getRestaurantOrdersService = async (id) => {
  try {
    const restaurant = await Restaurant.findById(id).select(
      "_id name address location phone_number",
    );
    if (!restaurant) {
      return { error: "Restaurant not found" };
    }

    const orders = await Order.find({ restaurant: id }).sort({ createdAt: -1 });

    return {
      response: {
        ...restaurant.toObject(),
        orders,
      },
    };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantOrdersService,
};
