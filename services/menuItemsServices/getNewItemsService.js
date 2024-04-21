const MenuItem = require("../../models/MenuItem");

const getNewItemsService = async () => {
  try {
    const response = await MenuItem.find()
      .sort({ _id: -1 })
      .limit(3)
      .select("name image");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getNewItemsService;
