const Category = require("../models/Category");

const createCategory = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name } = req.body;

  try {
    const category = await Category.findOne({ name });
    if (category) {
      return res.json({ message: "categorie existe déja" });
    }
    const newCategory = new Category({
      name,
      image: firebaseUrl,
    });
    const response = await newCategory.save();
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const response = await Category.find();
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getCategoriesNames = async (req, res) => {
  try {
    const response = await Category.find().select("name");
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const response = await Category.findById(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateCategory = async (req, res) => {
  const { name, image, description } = req.body;
  const { id } = req.params;
  try {
    const response = await Category.findByIdAndUpdate(
      id,
      { name, description, image },
      { new: true }
    );
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    await Category.findByIdAndDelete(id);
    res.status(202).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  deleteCategory,
  updateCategory,
  getCategory,
  getCategoriesNames,
};
