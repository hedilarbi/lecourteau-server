const Restaurant = require("../../models/Restaurant");

const getRestaurantsService = async () => {
  try {
    const response = await Restaurant.find();
    return { response };
  } catch (err) {
    console.error("Error in getRestaurantsService:", err); // Log the error
    return { error: err.message };
  }
};

module.exports = {
  getRestaurantsService,
};
