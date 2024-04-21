const MenuItem = require("../../models/MenuItem");

const triMenutItemsService = async (from, to) => {
  try {
    let menuitems = await MenuItem.find();

    const indexFrom = menuitems.findIndex((item) => item.order === from);
    const indexTo = menuitems.findIndex((item) => item.order === to);

    if (indexFrom !== -1 && indexTo !== -1) {
      menuitems[indexFrom].order = to;
      menuitems[indexTo].order = from;

      await Promise.all([
        menuitems[indexFrom].save(),
        menuitems[indexTo].save(),
      ]);
    } else {
      return { error: "Invalid 'from' or 'to' values" };
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = triMenutItemsService;
