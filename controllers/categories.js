const Category = require("../models/Category");
const createCategoryService = require("../services/categoriesServices/createCategoryService");
const deleteCategoryService = require("../services/categoriesServices/deleteCategoryService");

const createCategory = async (req, res) => {
  const {
    file,
    body: { name },
  } = req;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Category name is required",
    });
  }

  const firebaseUrl = file ? file.firebaseUrl : null;

  try {
    const { error, response } = await createCategoryService(name, firebaseUrl);

    if (error) {
      return res.status(400).json({ message: error });
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error("Error creating category:", err);
    return res.status(500).json({
      success: false,
      message: "An error occurred while creating the category.",
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const response = await Category.find();

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getCategoriesNames = async (req, res) => {
  try {
    const response = await Category.find().select("name");

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching category names:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getCategory = async (req, res) => {
  const { id } = req.params; // Extract the category ID from the request parameters
  try {
    const response = await Category.findById(id); // Attempt to find the category by ID

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Category not found", // Return a message if the category doesn't exist
      });
    }

    return res.status(200).json(response); // Return the category details if found
  } catch (err) {
    console.error("Error fetching category:", err); // Log the error for debugging
    return res.status(500).json({
      success: false,
      message: err.message, // Return the error message
    });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params; // Extract the category ID from the request parameters
  const { name } = req.body; // Extract the category name from the request body
  let firebaseUrl = null; // Initialize firebaseUrl

  if (req.file) {
    firebaseUrl = req.file.firebaseUrl; // Get the firebase URL if a file is uploaded
  }

  try {
    const updateData = { name }; // Prepare update data with the category name

    // If there's a new image URL, include it in the update data
    if (firebaseUrl) {
      updateData.image = firebaseUrl;
    }

    const response = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Category not found", // Return a message if the category doesn't exist
      });
    }

    return res.status(200).json(response); // Return the updated category details
  } catch (err) {
    console.error("Error updating category:", err); // Log the error for debugging
    return res.status(500).json({
      success: false,
      message: err.message, // Return the error message
    });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params; // Extract the category ID from the request parameters

  try {
    const { error } = await deleteCategoryService(id); // Attempt to delete the category using the service
    if (error) {
      return res.status(404).json({
        success: false,
        message: error, // Return an error message if the category is not found
      });
    }
    return res.status(200).json({
      success: true,
      message: "Category deleted successfully", // Confirm successful deletion
    });
  } catch (err) {
    console.error("Error deleting category:", err); // Log the error for debugging
    return res.status(500).json({
      success: false,
      message: err.message, // Return the error message
    });
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
