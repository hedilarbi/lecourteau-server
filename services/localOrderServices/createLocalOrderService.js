const LocalOrder = require("../../models/LocalOrder");
const Table = require("../../models/Table");

const createLocalOrderService = async (number) => {
  try {
    const table = await Table.findOne({ number });
    if (!table) {
      return { error: "table n'existe pas" };
    }
    const total_price = table.basket.reduce((acc, item) => acc + item.price, 0);
    const newLocalOrder = new LocalOrder({
      table: number,
      total_price,
      items: table.basket,
      state: "on_going",
    });
    const response = await newLocalOrder.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
  // const table = await Table
};

module.exports = createLocalOrderService;
