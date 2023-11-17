const { deleteImagesFromFirebase } = require("../firebase");
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
    res.status(500).json({ success: false, error: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const response = await Category.find();
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }
  const { name } = req.body;
  const { id } = req.params;
  try {
    let response;
    if (firebaseUrl) {
      response = await Category.findByIdAndUpdate(
        id,
        { name, image: firebaseUrl },
        { new: true }
      );
    } else {
      response = await Category.findByIdAndUpdate(id, { name }, { new: true });
    }
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await Category.findById(id);
    if (!response) {
      return res
        .status(404)
        .json({ success: false, message: "La catégorie n'existe pas" });
    }
    await deleteImagesFromFirebase(response.image);
    await Category.findByIdAndDelete(id);
    res.status(200).json({ message: "success" });
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
