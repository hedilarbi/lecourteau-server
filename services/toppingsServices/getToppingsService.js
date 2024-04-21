const Topping = require("../../models/Topping");

const getToppingsService = async () => {
  try {
    let response = await Topping.find().populate("category");
    response = response.reverse();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getToppingsService,
};
