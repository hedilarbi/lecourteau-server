const MenuItem = require("../../models/MenuItem");

const getMenuItemService = async (id) => {
  try {
    const response = await MenuItem.findById(id)
      .populate({
        path: "customization",
        populate: {
          path: "category",
        },
      })
      .populate("category");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getMenuItemService,
};
