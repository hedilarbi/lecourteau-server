const Table = require("../../models/Table");

const removeItemFromTableBasketService = async (number, uid) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    table.basket = table.basket.filter((item) => item.uid !== uid);
    const response = await table.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = removeItemFromTableBasketService;
