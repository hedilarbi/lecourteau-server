const { deleteImagesFromFirebase } = require("../firebase");
const Category = require("../models/Category");
const createCategoryService = require("../services/categoriesServices/createCategoryService");
const deleteCategoryService = require("../services/categoriesServices/deleteCategoryService");

const createCategory = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name } = req.body;

  try {
    const { error, response } = await createCategoryService(name, firebaseUrl);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

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
    const { error } = await deleteCategoryService(id);
    if (error) {
      return res.status(404).json(error);
    }
    res.status(200).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
