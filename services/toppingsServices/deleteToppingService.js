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
    const menuItems = await mongoose.models.MenuItem.find().select(
      "customization"
    );

    const restaurants = await mongoose.models.Restaurant.find().select(
      "toppings"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.toppings = restaurant.toppings.filter(
            (item) => item.topping.toString() !== id
          );
          await restaurant.save();
        })
      );
    }
    if (menuItems.length > 0) {
      await Promise.all(
        menuItems.map(async (menuItem) => {
          menuItem.customization = menuItem.customization.filter(
            (item) => item.toString() !== id
          );
          await menuItem.save();
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
