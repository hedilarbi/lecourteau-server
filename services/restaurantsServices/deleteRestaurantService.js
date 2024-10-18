const { default: mongoose } = require("mongoose");
const Restaurant = require("../../models/Restaurant");

const deleteRestaurantService = async (id) => {
  try {
    // Attempt to find and delete the restaurant
    const response = await Restaurant.findByIdAndDelete(id);

    // If the restaurant is not found, return an error
    if (!response) {
      return { error: "Restaurant not found." };
    }

    // Delete associated staff
    await mongoose.models.Staff.deleteMany({ restaurant: id });
    return { response };
  } catch (error) {
    console.error("Error in deleteRestaurantService:", error);
    return { error: error.message };
  }
};
module.exports = {
  deleteRestaurantService,
};
