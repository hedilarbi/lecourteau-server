const LocalOrder = require("../../models/LocalOrder");

const getLocalOrderService = async (localOrderId) => {
  try {
    const response = await LocalOrder.findById(localOrderId).populate({
      path: "items",
      populate: {
        path: "customizations item",
      },
    });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getLocalOrderService;
