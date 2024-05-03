const LocalOrder = require("../../models/LocalOrder");

const createLocalOrderService = async (orderData) => {
  try {
    const newLocalOrder = new LocalOrder({
      ...orderData,
    });
    const response = await newLocalOrder.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
  // const table = await Table
};

module.exports = createLocalOrderService;
