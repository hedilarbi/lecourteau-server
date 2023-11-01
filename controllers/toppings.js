const { deleteImagesFromFirebase } = require("../firebase");
const Topping = require("../models/Topping");

const createTopping = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, price, category } = req.body;

  try {
    const newTopping = new Topping({
      name,
      image: firebaseUrl,
      category,
      price: parseFloat(price),
    });
    const response = await newTopping.save();
    await Promise.all(
      restaurants.map(async (restaurant) => {
        restaurant.toppings.push({ topping: response._id, availability: true });
        await restaurant.save();
      })
    );

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getToppings = async (req, res) => {
  try {
    let response = await Topping.find().populate("category");
    response = response.reverse();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getTopping = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Topping.findById(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateTopping = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const { name, category, price } = req.body;
  const { id } = req.params;
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
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteTopping = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Topping.findById(id);
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "La personalisation n'existe pas" });
    }
    await deleteImagesFromFirebase(response.image);
    await Topping.findByIdAndDelete(id);
    const restaurants = await mongoose.models.Restaurant.find({}); // Retrieve all restaurants

    await Promise.all(
      restaurants.map(async (restaurant) => {
        // Find and remove the offer from the offers array
        restaurant.toppings = restaurant.toppings.filter(
          (restaurantOffer) => !restaurantOffer.topping.equals(id)
        );
        await restaurant.save();
      })
    );
    res.status(200).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createTopping,
  getToppings,
  deleteTopping,
  updateTopping,
  getTopping,
};
