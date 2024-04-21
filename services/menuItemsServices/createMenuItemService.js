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
    const menuItem = await MenuItem.findOne({ name });
    if (menuItem) {
      return { error: "Item already exists" };
    }
    const menuItems = await MenuItem.find();

    const order = menuItems.length;
    const newMenuItem = new MenuItem({
      name,
      image: firebaseUrl,
      prices: newPrices,
      description,
      customization: customizationArray,
      category,
      order,
    });
    const response = await newMenuItem.save();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "menu_items"
    );
    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.menu_items.push({
            menuItem: response._id,
            availability: true,
          });
          await restaurant.save();
        })
      );
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = createMenuItemService;
