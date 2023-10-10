const Topping = require("../models/Topping");

const createTopping = async (req, res) => {
  const { name, image, price, category } = req.body;

  try {
    const newTopping = new Topping({
      name,
      image:
        "https://lecourteau.com/wp-content/uploads/2021/11/WingsAlone-scaled-aspect-ratio-264-257-scaled.jpg",
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
    const response = await Topping.find().populate("category");
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
