const LocalOrder = require("../../models/LocalOrder");
const clearTableBasketService = require("../tablesServices.js/clearTableBasketService");

const updateLocalOrderStateService = async (localOrderId, state) => {
  try {
    const response = await LocalOrder.findByIdAndUpdate(localOrderId, {
      state,
    });
    if (state === "completed") {
      await clearTableBasketService(response.table);
    }
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateLocalOrderStateService;
