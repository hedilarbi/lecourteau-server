const MenuItem = require("../../models/MenuItem");

const createMenuItemService = async (
  name,
  firebaseUrl,
  newPrices,
  description,

  category,
  customizationGroup
) => {
  try {
    const existingMenuItem = await MenuItem.findOne({ name }); // Check if the item already exists
    if (existingMenuItem) {
      return { error: "Item already exists" }; // Return error if the item exists
    }

    const menuItemsCount = await MenuItem.countDocuments(); // Get the current number of menu items
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const newMenuItem = new MenuItem({
      name,
      image: firebaseUrl,
      prices: newPrices,
      description,

      category,
      slug,
      order: menuItemsCount, // Set the order based on the count
      customization_group: Array.isArray(customizationGroup)
        ? customizationGroup
        : [],
    });

    const savedMenuItem = await newMenuItem.save(); // Save the new menu item

    return { response: savedMenuItem }; // Return the saved menu item
  } catch (err) {
    console.error("Error in createMenuItemService:", err); // Log the error
    return { error: err.message }; // Return error message
  }
};

module.exports = createMenuItemService;
