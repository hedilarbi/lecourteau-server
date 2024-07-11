const Category = require("../models/Category");
const createCategoryService = require("../services/categoriesServices/createCategoryService");
const deleteCategoryService = require("../services/categoriesServices/deleteCategoryService");

const createCategory = async (req, res) => {
  let firebaseUrl = null;
  if (req.file) {
    firebaseUrl = req.file.firebaseUrl;
  }

  const { name, customization } = req.body;
  const customizationArray = JSON.parse(customization);
  try {
    const { error, response } = await createCategoryService(
      name,
      firebaseUrl,
      customizationArray
    );
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
    const response = await Category.findById(id).populate("customization");
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
  const { name, customization } = req.body;
  const { id } = req.params;
  const customizationArray = JSON.parse(customization);
  const newCustomization = customizationArray.map((custo) => {
    return { _id: custo._id };
  });
  try {
    let response;
    if (firebaseUrl) {
      response = await Category.findByIdAndUpdate(
        id,
        { name, image: firebaseUrl, customization: newCustomization },
        { new: true }
      );
    } else {
      response = await Category.findByIdAndUpdate(
        id,
        { name, customization: newCustomization },
        { new: true }
      );
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
