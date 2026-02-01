const MenuItem = require("../../models/MenuItem");
const Table = require("../../models/Table");

const getItemFromBasketService = async (number, uid) => {
  try {
    const table = await Table.findOne({ number }).populate({
      path: "basket",
      populate: {
        path: "customizations item",
      },
    });
    const itemFromBasket = table.basket.find((item) => item.uid === uid);

    const item = await MenuItem.findById(itemFromBasket.item._id)
      .populate({
        path: "customization",
        populate: {
          path: "category",
        },
      })
      .populate("category");

    return { response: { item, itemFromBasket } };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = getItemFromBasketService;
