const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../../firebase");
const MenuItem = require("../../models/MenuItem");

const deleteMenuItemService = async (id) => {
  try {
    const response = await MenuItem.findById(id);
    if (!response) {
      return { error: "Article n'existe pas" };
    }
    await deleteImagesFromFirebase(response.image);
    await MenuItem.findByIdAndDelete(id);
    const restaurants = await mongoose.models.Restaurant.find().select(
      "menu_items"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.menu_items = restaurant.menu_items.filter(
            (restaurantOffer) => !restaurantOffer.menuItem.equals(id)
          );
          await restaurant.save();
        })
      );
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteMenuItemService;
