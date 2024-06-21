const { default: mongoose } = require("mongoose");
const Restaurant = require("../../models/Restaurant");

const deleteRestaurantService = async (id) => {
  try {
    const response = await Restaurant.findByIdAndDelete(id);
    await mongoose.models.Staff.deleteMany({ restaurant: id });
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  deleteRestaurantService,
};
