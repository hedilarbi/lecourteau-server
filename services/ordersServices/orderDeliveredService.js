const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const { DELIVERED, DONE } = require("../../utils/constants");

const orderDeliveredService = async (id, staffId) => {
  try {
    // Update the order status to DONE
    const order = await Order.findByIdAndUpdate(
      id,
      { status: DONE },
      { new: true }
    );

    // Check if the order was found
    if (!order) {
      return { error: "Order not found" };
    }

    // Update staff availability
    const staff = await mongoose.models.Staff.findByIdAndUpdate(
      staffId,
      { is_available: true },
      { new: true }
    );

    // Check if the staff member was found
    if (!staff) {
      return { error: "Staff member not found" };
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = orderDeliveredService;
