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
    const rewards = await mongoose.models.Reward.find().select("item");
    const offers = await mongoose.models.Offer.find().select("items");
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.menu_items = restaurant.menu_items.filter(
            (item) => item.menuItem.toString() !== id
          );
          await restaurant.save();
        })
      );
    }
    if (rewards.length > 0) {
      await Promise.all(
        rewards.map(async (reward) => {
          if (reward.item.toString() === id) {
            await mongoose.models.Reward.findByIdAndDelete(reward._id);
          }
        })
      );
    }
    if (offers.length > 0) {
      await Promise.all(
        offers.map(async (offer) => {
          if (offer.items.toString().includes(id)) {
            await mongoose.models.Offer.findByIdAndDelete(offer._id);
          }
        })
      );
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = deleteMenuItemService;
