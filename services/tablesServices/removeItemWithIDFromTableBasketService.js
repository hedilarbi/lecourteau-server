const Table = require("../../models/Table");

const removeItemWithIDFromTableBasketService = async (number, id) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }

    const index = table.basket.findIndex((item) => item.item.toString() === id);

    if (index !== -1) {
      table.basket.splice(index, 1);
    }
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

module.exports = removeItemWithIDFromTableBasketService;
