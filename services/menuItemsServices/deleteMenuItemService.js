const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../../firebase");
const MenuItem = require("../../models/MenuItem");

const deleteMenuItemService = async (id) => {
  try {
    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return { error: "Item does not exist" };
    }

    await deleteImagesFromFirebase(menuItem.image);
    await MenuItem.findByIdAndDelete(id);

    await updateRestaurantsMenuItems(id);
    await deleteRelatedRewards(id);
    await deleteRelatedOffers(id);

    return {}; // Return an empty object if the deletion is successful
  } catch (err) {
    return { error: err.message };
  }
};

const updateRestaurantsMenuItems = async (itemId) => {
  const restaurants = await mongoose.models.Restaurant.find().select(
    "menu_items"
  );
  if (restaurants.length > 0) {
    await Promise.all(
      restaurants.map(async (restaurant) => {
        restaurant.menu_items = restaurant.menu_items.filter(
          (item) => item.menuItem.toString() !== itemId
        );
        await restaurant.save();
      })
    );
  }
};

const deleteRelatedRewards = async (itemId) => {
  const rewards = await mongoose.models.Reward.find().select("item");
  if (rewards.length > 0) {
    await Promise.all(
      rewards.map(async (reward) => {
        if (reward.item.toString() === itemId) {
          await mongoose.models.Reward.findByIdAndDelete(reward._id);
        }
      })
    );
  }
};

const deleteRelatedOffers = async (itemId) => {
  const offers = await mongoose.models.Offer.find().select("items");
  if (offers.length > 0) {
    await Promise.all(
      offers.map(async (offer) => {
        if (offer.items.toString().includes(itemId)) {
          await mongoose.models.Offer.findByIdAndDelete(offer._id);
        }
      })
    );
  }
};

module.exports = deleteMenuItemService;
