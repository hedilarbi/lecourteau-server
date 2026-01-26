const Table = require("../../models/Table");

const getTableBasketService = async (number) => {
  try {
    const table = await Table.findOne({ number }).populate({
      path: "basket",
      populate: {
        path: "customizations item",
      },
    });
    const total = table.basket.reduce((acc, item) => acc + item.price, 0);
    const basket = table.basket;
    return { response: { basket, total } };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getTableBasketService;
