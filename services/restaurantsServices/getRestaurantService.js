const Restaurant = require("../../models/Restaurant");

const getRestaurantService = async (id) => {
  try {
    const response = await Restaurant.findById(id);
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getRestaurantService,
};
