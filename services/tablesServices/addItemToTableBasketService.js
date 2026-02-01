const Table = require("../../models/Table");

const addItemToTableBasketService = async (number, item) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    table.basket.push(item);
    await table.save();
    const { basket } = await Table.findOne({ number }).populate({
      path: "basket",
      populate: {
        path: "customizations item",
      },
    });

    const total = basket.reduce((acc, item) => acc + item.price, 0);

    return { response: { basket, total } };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = addItemToTableBasketService;
