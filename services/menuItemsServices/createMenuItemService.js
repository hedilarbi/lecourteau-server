const { default: mongoose } = require("mongoose");
const MenuItem = require("../../models/MenuItem");

const createMenuItemService = async (
  name,
  firebaseUrl,
  newPrices,
  description,
  customizationArray,
  category
) => {
  try {
    const existingMenuItem = await MenuItem.findOne({ name }); // Check if the item already exists
    if (existingMenuItem) {
      return { error: "Item already exists" }; // Return error if the item exists
    }

    const menuItemsCount = await MenuItem.countDocuments(); // Get the current number of menu items
    const newMenuItem = new MenuItem({
      name,
      image: firebaseUrl,
      prices: newPrices,
      description,
      customization: customizationArray,
      category,
      order: menuItemsCount, // Set the order based on the count
    });

    const savedMenuItem = await newMenuItem.save(); // Save the new menu item

    // Update related restaurants
    const restaurants = await mongoose.models.Restaurant.find().select(
      "menu_items"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.menu_items.push({
            menuItem: savedMenuItem._id,
            availability: true,
          });
          await restaurant.save(); // Save the updated restaurant
        })
      );
    }

    return { response: savedMenuItem }; // Return the saved menu item
  } catch (err) {
    console.error("Error in createMenuItemService:", err); // Log the error
    return { error: err.message }; // Return error message
  }
};

module.exports = createMenuItemService;
