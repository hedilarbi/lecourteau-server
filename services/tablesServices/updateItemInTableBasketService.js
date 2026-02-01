const Table = require("../../models/Table");

const updateItemInTableBasketService = async (number, item) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    const index = table.basket.findIndex((el) => el.uid === item.uid);
    table.basket[index] = item;
    await table.save();
    const { basket } = await Table.findOne({ number }).populate({
      path: "basket",
      populate: {
        path: "customizations item",
      },
    });
    const total = basket.reduce((acc, item) => acc + item.price, 0);
    return { response: { total, basket } };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = updateItemInTableBasketService;
