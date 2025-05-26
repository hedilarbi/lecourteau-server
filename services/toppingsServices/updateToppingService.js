const Topping = require("../../models/Topping");

const updateToppingService = async (id, name, price, category, firebaseUrl) => {
  try {
    let response;
    if (firebaseUrl) {
      response = await Topping.findByIdAndUpdate(
        id,
        { name, image: firebaseUrl, category, price: parseFloat(price) },
        { new: true }
      );
    } else {
      response = await Topping.findByIdAndUpdate(
        id,
        { name, category, price: parseFloat(price) },
        { new: true }
      );
    }
    return { response };
  } catch (err) {
    console.error("Error updating topping:", err);
    return { error: err.message };
  }
};

module.exports = {
  updateToppingService,
};
