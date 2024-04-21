const Topping = require("../../models/Topping");
const mongoose = require("mongoose");

const createToppingService = async (name, price, category, firebaseUrl) => {
  try {
    const topping = await Topping.findOne({ name });
    if (topping) {
      return { error: "Topping already exists" };
    }
    const newTopping = new Topping({
      name,
      image: firebaseUrl,
      category,
      price: parseFloat(price),
    });
    const response = await newTopping.save();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "toppings"
    );

    if (restaurants.length > 0) {
      await Promise.all(
        restaurants.map(async (restaurant) => {
          restaurant.toppings.push({
            topping: response._id,
            availability: true,
          });
          await restaurant.save();
        })
      );
    }

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  createToppingService,
};
