const { deleteImagesFromFirebase } = require("../../firebase");
const Topping = require("../../models/Topping");
const mongoose = require("mongoose");
const deleteToppingService = async (id) => {
  try {
    const topping = await Topping.findById(id);
    if (!topping) {
      return { error: "Topping not found" };
    }
    await deleteImagesFromFirebase(topping.image);
    await Topping.findByIdAndDelete(id);
    const restaurants = await mongoose.models.Restaurant.find().select(
      "toppings"
    ); // Retrieve all restaurants
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          // Find and remove the offer from the offers array
          restaurant.toppings = restaurant.toppings.filter(
            (restaurantOffer) => !restaurantOffer.topping.equals(id)
          );
          await restaurant.save();
        })
      );
    }
    return { status: true };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = {
  deleteToppingService,
};
