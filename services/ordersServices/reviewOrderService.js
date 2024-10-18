const Order = require("../../models/Order");
const reviewOrderService = async (id, review) => {
  try {
    const order = await Order.findByIdAndUpdate(id, { review }, { new: true });

    if (!order) {
      return { error: "Order not found" };
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = reviewOrderService;
