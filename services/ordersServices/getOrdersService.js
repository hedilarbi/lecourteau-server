const Order = require("../../models/Order");

const getOrdersService = async () => {
  try {
    const orders = await Order.find();
    const response = orders.reverse();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrdersService;
