const Restaurant = require("../../models/Restaurant");

const getRestaurantsService = async () => {
  try {
    const response = await Restaurant.find();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getRestaurantsService,
};
