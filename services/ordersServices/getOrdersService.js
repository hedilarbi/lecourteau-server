const Order = require("../../models/Order");

const getOrdersService = async () => {
  try {
    const response = await Order.find();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrdersService;
