const Table = require("../../models/Table");

const addItemToTableBasketService = async (number, item) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    table.basket.push(item);
    const response = await table.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = addItemToTableBasketService;
