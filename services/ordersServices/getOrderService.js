const Order = require("../../models/Order");

const getOrderService = async (id) => {
  try {
    const response = await Order.findById(id)
      .populate({
        path: "orderItems",
        populate: "customizations item",
      })
      .populate({ path: "offers", populate: "offer customizations" })
      .populate({ path: "rewards", populate: "item" })
      .populate({ path: "user", select: "name phone_number email" })
      .populate({ path: "delivery_by", select: "name" })
      .populate("restaurant");

    if (!response) {
      return { error: "Order not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrderService;
