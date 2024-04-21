const Order = require("../../models/Order");

const reviewOrderService = async (id, review) => {
  try {
    await Order.findByIdAndUpdate(id, { review }, { new: true });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = reviewOrderService;
