const Restaurant = require("../../models/Restaurant");

const getRestaurantService = async (id) => {
  try {
    const response = await Restaurant.findById(id);
    if (!response) {
      return { error: "Restaurant not found." };
    }
    return { response };
  } catch (error) {
    console.error("Error in getRestaurantService:", error); // Log the error
    return { error: error.message };
  }
};
module.exports = {
  getRestaurantService,
};
