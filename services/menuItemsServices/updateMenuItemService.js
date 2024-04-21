const MenuItem = require("../../models/MenuItem");

const updateMenuItemService = async (
  id,
  name,
  firebaseUrl,
  newPrices,
  description,
  category,
  newCustomization
) => {
  try {
    let response;
    if (firebaseUrl) {
      response = await MenuItem.findByIdAndUpdate(
        id,
        {
          name,
          image: firebaseUrl,
          prices: newPrices,
          description,
          category,
          customization: newCustomization,
        },
        { new: true }
      ).populate("customization category");
    } else {
      response = await MenuItem.findByIdAndUpdate(
        id,
        {
          name,
          prices: newPrices,
          description,
          category,
          customization: newCustomization,
        },
        { new: true }
      ).populate("customization category");
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateMenuItemService;
