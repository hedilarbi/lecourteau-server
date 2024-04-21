const Restaurant = require("../../models/Restaurant");

const deleteRestaurantService = async (id) => {
  try {
    const response = await Restaurant.findByIdAndDelete(id);
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  deleteRestaurantService,
};
