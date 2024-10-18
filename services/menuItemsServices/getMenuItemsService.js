const MenuItem = require("../../models/MenuItem");

const getMenuItemsService = async () => {
  try {
    const response = await MenuItem.find()
      .select("category name image prices is_available order")
      .populate({ path: "category", select: "name" });

    // Sort the response by order
    response.sort((a, b) => a.order - b.order);

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getMenuItemsService;
