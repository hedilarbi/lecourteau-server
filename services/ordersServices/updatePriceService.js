const Order = require("../../models/Order");

const updatePriceService = async (id, price) => {
  try {
    const response = await Order.findByIdAndUpdate(
      id,
      { total_price: parseFloat(price) },
      { new: true }
    );

    if (!response) {
      return { error: "Order not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updatePriceService;
