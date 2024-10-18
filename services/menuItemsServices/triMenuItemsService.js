const MenuItem = require("../../models/MenuItem");

const triMenutItemsService = async (list) => {
  try {
    const menuItems = await MenuItem.find();

    // Collect promises for saving the updated items
    const savePromises = list.map(async (item) => {
      const menuItem = menuItems.find(
        (menuItem) => menuItem._id.toString() === item.id
      );
      if (!menuItem) {
        return { error: `Item with ID ${item.id} not found` }; // Return error if item not found
      }
      menuItem.order = item.order;
      return menuItem.save(); // Return the save promise
    });

    // Execute all save promises
    await Promise.all(savePromises);

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = triMenutItemsService;
