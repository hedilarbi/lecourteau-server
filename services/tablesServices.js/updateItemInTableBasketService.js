const Table = require("../../models/Table");

const updateItemInTableBasketService = async (number, item) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    const index = table.basket.findIndex((el) => el.uid === item.uid);
    table.basket[index] = item;
    const response = await table.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateItemInTableBasketService;
