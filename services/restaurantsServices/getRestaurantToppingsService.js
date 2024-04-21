const Restaurant = require("../../models/Restaurant");

const getRestaurantToppingsService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("toppings")
      .populate({
        path: "toppings",
        populate: { path: "topping", populate: "category" },
      });

    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantToppingsService,
};
