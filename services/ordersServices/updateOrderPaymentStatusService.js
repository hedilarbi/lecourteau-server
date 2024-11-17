const Order = require("../../models/Order");

const updateOrderPaymentStatusService = async (orderId, paymentStatus) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { error: "Order not found" };
    }
    order.payment_status = paymentStatus;
    await order.save();
    return { success: true, order };
  } catch (err) {
    console.error(err.message);
    return { error: err.message };
  }
};

module.exports = updateOrderPaymentStatusService;
