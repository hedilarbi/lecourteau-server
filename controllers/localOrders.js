const createLocalOrderService = require("../services/localOrderServices/createLocalOrderService");

const createLocalOrder = async (req, res) => {
  try {
    const { items, table, user } = req.body;
    let total_price = 0;
    items.forEach((item) => {
      total_price += item.price;
    });

    const { response, error } = await createLocalOrderService({
      items,
      total_price,
      table,
      state: "on_going",
      user,
    });
    if (error) {
      return res.status(400).json({ error });
    }
    res.status(201).json({ response });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = createLocalOrder;
