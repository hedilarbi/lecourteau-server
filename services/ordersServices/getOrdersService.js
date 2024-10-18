const Order = require("../../models/Order");

const getOrdersService = async (query) => {
  try {
    const { sort = "desc", limit = 10 } = query;
    const sortOrder = sort === "asc" ? 1 : -1;

    const orders = await Order.find()
      .sort({ createdAt: sortOrder })
      .limit(parseInt(limit));

    return { response: orders };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getOrdersService;
