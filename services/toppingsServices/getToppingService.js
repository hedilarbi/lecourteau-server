const Topping = require("../../models/Topping");

const getToppingService = async (id) => {
  try {
    let response = await Topping.findById(id);
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getToppingService,
};
