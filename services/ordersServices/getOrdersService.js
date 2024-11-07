const Order = require("../../models/Order");

const getOrdersService = async () => {
  try {
    const orders = await Order.find();
    return { response: orders };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrdersService;
