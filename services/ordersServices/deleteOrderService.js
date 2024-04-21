const Order = require("../../models/Order");

const deleteOrderService = async (id) => {
  try {
    await Order.findByIdAndDelete(id);
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = deleteOrderService;
