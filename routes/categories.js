const express = require("express");
const {
  createCategory,
  getCategories,
  deleteCategory,
  updateCategory,
  getCategory,
  getCategoriesNames,
} = require("../controllers/categories");

const router = express.Router();

router.get("/", getCategories);
router.get("/names", getCategoriesNames);
router.post("/create", createCategory);
router.put("/update/:id", updateCategory);
router.delete("/delete/:id", deleteCategory);
router.get("/:id", getCategory);

module.exports = router;
