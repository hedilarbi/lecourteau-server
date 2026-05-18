const express = require("express");
const {
  createRecipe,
  getRecipes,
  getRecipe,
  updateRecipe,
  deleteRecipe,
} = require("../controllers/recipes");

const router = express.Router();

router.get("/", getRecipes);
router.get("/:id", getRecipe);
router.post("/create", createRecipe);
router.put("/update/:id", updateRecipe);
router.delete("/delete/:id", deleteRecipe);

module.exports = router;
