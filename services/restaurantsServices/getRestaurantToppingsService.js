const Restaurant = require("../../models/Restaurant");

const getRestaurantToppingsService = async (id) => {
  try {
    const response = await Restaurant.findById(id)
      .select("toppings")
      .populate({
        path: "toppings",
        populate: { path: "topping", populate: "category" },
      });

    // Check if the restaurant exists
    if (!response) {
      return { error: new Error("Restaurant not found") };
    }

    return { response: response.toppings }; // Return only the toppings
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantToppingsService,
};
