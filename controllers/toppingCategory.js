const ToppingCategory = require("../models/ToppingCategory");

const createToppingCategory = async (req, res) => {
  const { name } = req.body;

  try {
    const toppingCategory = await ToppingCategory.findOne({ name });
    if (toppingCategory) {
      return res.json({ message: "categorie existe déja" });
    }
    const newToppingCategory = new ToppingCategory({
      name,
    });
    const response = await newToppingCategory.save();
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getToppingCategories = async (req, res) => {
  try {
    const response = await ToppingCategory.find();
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getToppingCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await ToppingCategory.findById(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateToppingCategory = async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;
  try {
    const response = await ToppingCategory.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteToppingCategory = async (req, res) => {
  const { id } = req.params;

  try {
    await ToppingCategory.findByIdAndDelete(id);
    res.status(202).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createToppingCategory,
  getToppingCategories,
  getToppingCategory,
  updateToppingCategory,
  deleteToppingCategory,
};
