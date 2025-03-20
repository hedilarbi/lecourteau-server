const MenuItem = require("../../models/MenuItem");

const getNewItemsService = async () => {
  try {
    const response = await MenuItem.find()
      .sort({ _id: -1 }) // Sort items by newest first
      .limit(5) // Limit to the latest 3 items
      .select("name image"); // Select only the name and image fields
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getNewItemsService;
