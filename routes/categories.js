const express = require("express");
const {
  createCategory,
  getCategories,
  deleteCategory,
  updateCategory,
  getCategory,
  getCategoriesNames,
  triCategories,
  updateCategoryOrder,
} = require("../controllers/categories");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");

const router = express.Router();

router.get("/", getCategories);
router.get("/names", getCategoriesNames);
router.put("/tri", triCategories);
router.put("/test", updateCategoryOrder);
router.post(
  "/create",
  Multer.single("file"),
  optimizeImage,
  uploadImageToFirebase,
  createCategory
);
router.put(
  "/update/:id",
  Multer.single("file"),
  optimizeImage,

  updateMenuItemImageInFirebase,
  updateCategory
);
router.delete("/delete/:id", deleteCategory);
router.get("/:id", getCategory);

module.exports = router;
