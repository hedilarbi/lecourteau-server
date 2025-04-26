const Order = require("../../models/Order");

const getOrderService = async (id) => {
  try {
    const response = await Order.findById(id)
      .populate({
        path: "orderItems",
        populate: "customizations item",
      })
      .populate({
        path: "offers",
        populate: [
          { path: "offer" },
          {
            path: "items.item",
            select: "name",
          },
          {
            path: "items.customizations",
            select: "name",
          },
        ],
      })
      .populate({ path: "rewards", populate: "item" })
      .populate({ path: "user", select: "name phone_number email" })
      .populate("restaurant", "name");

    if (!response) {
      return { error: "Order not found" };
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrderService;
