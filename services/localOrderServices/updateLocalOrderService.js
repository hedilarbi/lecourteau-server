const LocalOrder = require("../../models/LocalOrder");

const updateLocalOrderService = async (id, items, total_price) => {
  try {
    const response = await LocalOrder.findByIdAndUpdate(id, {
      items,
      total_price,
    });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateLocalOrderService;
