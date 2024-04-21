const ToppingCategory = require("../models/ToppingCategory");
const {
  createToppingCategoryService,
} = require("../services/toppingsCategoryService/createToppingCategoryService");
const {
  deleteToppingCategoryService,
} = require("../services/toppingsCategoryService/deleteToppingCategoryService");
const {
  getToppingCategoriesService,
} = require("../services/toppingsCategoryService/getToppingCategoriesService");
const {
  getToppingCategoryService,
} = require("../services/toppingsCategoryService/getToppingCategoryService");
const {
  updateToppingCategoryService,
} = require("../services/toppingsCategoryService/updateToppingCategoryService");

const createToppingCategory = async (req, res) => {
  const { name } = req.body;

  try {
    const { response, error } = await createToppingCategoryService(name);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getToppingCategories = async (req, res) => {
  try {
    const { response } = await getToppingCategoriesService();
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getToppingCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const { response } = await getToppingCategoryService(id);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateToppingCategory = async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;
  try {
    const { response } = await updateToppingCategoryService(id, name);
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteToppingCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const { response } = await deleteToppingCategoryService(id);
    res.status(200).json({ success: true, response });
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
