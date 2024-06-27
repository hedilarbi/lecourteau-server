const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../../firebase");
const Category = require("../../models/Category");

const deleteCategoryService = async (id) => {
  try {
    const response = await Category.findById(id);
    if (!response) {
      return { error: "Category not found" };
    }
    await deleteImagesFromFirebase(response.image);
    await Category.findByIdAndDelete(id);
    const menuItems = await mongoose.models.MenuItem.find().select("category");
    const restaurants = await mongoose.models.Restaurant.find();
    const rewards = await mongoose.models.Reward.find().select("item");
    const offers = await mongoose.models.Offer.find().select("items");

    if (menuItems.length > 0) {
      await Promise.all(
        menuItems.map(async (menuItem) => {
          if (menuItem.category.toString() === id) {
            await mongoose.models.MenuItem.findByIdAndDelete(menuItem._id);
            if (restaurants.length > 0) {
              await Promise.all(
                restaurants.map(async (restaurant) => {
                  restaurant.menu_items = restaurant.menu_items.filter(
                    (item) => item.menuItem.toString() !== menuItem._id
                  );
                  await restaurant.save();
                })
              );
            }
            if (rewards.length > 0) {
              await Promise.all(
                rewards.map(async (reward) => {
                  if (reward.item.toString() === menuItem._id.toString()) {
                    await mongoose.models.Reward.findByIdAndDelete(reward._id);
                  }
                })
              );
            }
            if (offers.length > 0) {
              await Promise.all(
                offers.map(async (offer) => {
                  if (offer.items.toString().includes(menuItem._id)) {
                    await mongoose.models.Offer.findByIdAndDelete(offer._id);
                  }
                })
              );
            }
          }
        })
      );
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteCategoryService;
