const createRecipeService = require("../services/recipesServices/createRecipeService");
const deleteRecipeService = require("../services/recipesServices/deleteRecipeService");
const updateRecipeService = require("../services/recipesServices/updateRecipeService");
const getRecipesService = require("../services/recipesServices/getRecipesService");
const getRecipeService = require("../services/recipesServices/getRecipeService");

const createRecipe = async (req, res) => {
  const { item, category, ingredients, instruction } = req.body;
  try {
    const { error, response } = await createRecipeService(
      item,
      category,
      ingredients,
      instruction
    );
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    return res.status(201).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getRecipes = async (req, res) => {
  try {
    const { error, response } = await getRecipesService();
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getRecipe = async (req, res) => {
  const { id } = req.params;
  try {
    const { error, response } = await getRecipeService(id);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }
    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateRecipe = async (req, res) => {
  const { id } = req.params;
  const { item, category, ingredients, instruction } = req.body;
  try {
    const { error, response } = await updateRecipeService(
      id,
      item,
      category,
      ingredients,
      instruction
    );
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteRecipe = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await deleteRecipeService(id);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    return res.status(200).json({ success: true, message: "Recipe deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createRecipe, getRecipes, getRecipe, updateRecipe, deleteRecipe };
