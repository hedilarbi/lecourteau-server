const MenuItem = require("../../models/MenuItem");

const triMenutItemsService = async (list) => {
  try {
    const menuItems = await MenuItem.find();
    for (const item of list) {
      const itemIndex = menuItems.findIndex(
        (menuItem) => menuItem._id == item.id
      );
      if (itemIndex !== -1) {
        menuItems[itemIndex].order = item.order;
      }

      await menuItems[itemIndex].save();
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = triMenutItemsService;
