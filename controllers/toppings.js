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
  const { name, image, category, price } = req.body;
  const { id } = req.params;
  try {
    const response = await Topping.findByIdAndUpdate(
      id,
      { name, description, image, price: parseFloat(price) },
      { new: true }
    );
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteTopping = async (req, res) => {
  const { id } = req.params;

  try {
    await Topping.findByIdAndDelete(id);
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
