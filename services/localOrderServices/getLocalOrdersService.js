const LocalOrder = require("../../models/LocalOrder");

const getLocalOrdersService = async () => {
  try {
    const response = await LocalOrder.find();

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getLocalOrdersService;
