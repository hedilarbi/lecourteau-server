const Table = require("../../models/Table");

const clearTableBasketService = async (number) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    table.basket = [];
    const response = await table.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = clearTableBasketService;
