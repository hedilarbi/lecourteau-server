const MenuItem = require("../../models/MenuItem");

const updateMenuItemService = async (
  id,
  name,
  firebaseUrl,
  newPrices,
  description,
  category,
  customization
) => {
  try {
    const updateData = {
      name,
      prices: newPrices,
      description,
      category,
      customization,
    };

    if (firebaseUrl) {
      updateData.image = firebaseUrl;
    }

    const response = await MenuItem.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate("customization category");

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateMenuItemService;
