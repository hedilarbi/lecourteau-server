const User = require("../../models/User");

const getOrdersListService = async (id) => {
  try {
    let user = await User.findById(id)
      .select("orders")
      .populate({
        path: "orders",
        populate: { path: "orderItems", populate: "item customizations" },
      });
    user.orders = user.orders.reverse();
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getOrdersListService,
};
