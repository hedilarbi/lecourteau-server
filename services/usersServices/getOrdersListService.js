const User = require("../../models/User");

const getOrdersListService = async (id) => {
  try {
    const user = await User.findById(id)
      .select("orders")
      .populate({
        path: "orders",
        populate: { path: "orderItems", populate: "item customizations" },
      });
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getOrdersListService,
};
