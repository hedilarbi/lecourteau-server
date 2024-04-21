const { default: mongoose } = require("mongoose");
const Order = require("../../models/Order");
const { DELIVERED, DONE } = require("../../utils/constants");

const orderDeliveredService = async (id, staffId) => {
  try {
    const response = await Order.findByIdAndUpdate(id, {
      status: DONE,
    });

    if (response) {
      await mongoose.models.Staff.findByIdAndUpdate(staffId, {
        is_available: true,
      });
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = orderDeliveredService;
