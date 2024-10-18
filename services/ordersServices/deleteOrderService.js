const Order = require("../../models/Order");

const deleteOrderService = async (id) => {
  try {
    const order = await Order.findByIdAndDelete(id);
    if (!order) {
      return { error: "Order not found", success: false };
    }
    return { error: null, success: true };
  } catch (err) {
    return { error: err.message, success: false };
  }
};
module.exports = deleteOrderService;
