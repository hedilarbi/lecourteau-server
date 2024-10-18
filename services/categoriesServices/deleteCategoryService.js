const { default: mongoose } = require("mongoose");
const { deleteImagesFromFirebase } = require("../../firebase");
const Category = require("../../models/Category");

const deleteCategoryService = async (id) => {
  try {
    const category = await Category.findById(id); // Find the category by ID
    if (!category) {
      return { error: "Category not found" }; // Return error if category doesn't exist
    }

    await deleteImagesFromFirebase(category.image); // Delete associated image from Firebase
    await Category.findByIdAndDelete(id); // Delete the category

    // Get related items
    const menuItems = await mongoose.models.MenuItem.find().select("category");
    const restaurants = await mongoose.models.Restaurant.find();
    const rewards = await mongoose.models.Reward.find().select("item");
    const offers = await mongoose.models.Offer.find().select("items");

    // Process related menu items and remove dependencies
    if (menuItems.length > 0) {
      await Promise.all(
        menuItems.map(async (menuItem) => {
          if (menuItem.category.toString() === id) {
            await mongoose.models.MenuItem.findByIdAndDelete(menuItem._id); // Delete the menu item

            // Remove menu item reference from restaurants
            if (restaurants.length > 0) {
              await Promise.all(
                restaurants.map(async (restaurant) => {
                  restaurant.menu_items = restaurant.menu_items.filter(
                    (item) => item.menuItem.toString() !== menuItem._id
                  );
                  await restaurant.save(); // Save the updated restaurant
                })
              );
            }

            // Remove related rewards
            if (rewards.length > 0) {
              await Promise.all(
                rewards.map(async (reward) => {
                  if (reward.item.toString() === menuItem._id.toString()) {
                    await mongoose.models.Reward.findByIdAndDelete(reward._id); // Delete the reward
                  }
                })
              );
            }

            // Remove related offers
            if (offers.length > 0) {
              await Promise.all(
                offers.map(async (offer) => {
                  if (offer.items.toString().includes(menuItem._id)) {
                    await mongoose.models.Offer.findByIdAndDelete(offer._id); // Delete the offer
                  }
                })
              );
            }
          }
        })
      );
    }

    return { error: null }; // Return success without error
  } catch (err) {
    console.error("Error in deleteCategoryService:", err); // Log the error for debugging
    return { error: err.message }; // Return the error message
  }
};

module.exports = deleteCategoryService;
