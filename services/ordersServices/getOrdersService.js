const Order = require("../../models/Order");

const getOrdersService = async () => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return { response: orders };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrdersService;
