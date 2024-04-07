const User = require("../../models/User");

const getOrdersListService = async (id) => {
  const user = await User.findById(id)
    .select("orders")
    .populate({
      path: "orders",
      populate: { path: "orderItems", populate: "item customizations" },
    });
  return user;
};

module.exports = {
  getOrdersListService,
};
