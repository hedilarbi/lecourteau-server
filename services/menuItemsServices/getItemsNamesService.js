const MenuItem = require("../../models/MenuItem");

const getItemsNamesService = async () => {
  try {
    const response = await MenuItem.find().select("name prices");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getItemsNamesService;
