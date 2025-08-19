const express = require("express");
const {
  createMenuItem,
  updateMenuItem,
  getMenuItem,
  getMenuItems,
  deleteMenuItem,
  getMenuItemsByCategory,
  getItemsNames,
  updateMenuItemAvailability,
  getNewItems,
  triMenutItems,
  createSlug,
  getMenuItemBySlug,
  getMenuItemsByCategorySlug,
} = require("../controllers/menuItems");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");
const router = express.Router();

router.get("/", getMenuItems);
router.put("/tri", triMenutItems);
router.get("/slug", createSlug);
router.get("/name", getItemsNames);
router.get("/new", getNewItems);
router.post(
  "/create",
  Multer.single("file"),
  optimizeImage,
  uploadImageToFirebase,
  createMenuItem
);
router.put(
  "/update/:id",
  Multer.single("file"),
  optimizeImage,
  updateMenuItemImageInFirebase,
  updateMenuItem
);
router.put("update/availability/:id", updateMenuItemAvailability);
router.get("/slug/:slug", getMenuItemBySlug);
router.delete("/delete/:id", deleteMenuItem);
router.get("/category/:categoryId", getMenuItemsByCategory);
router.get("/:id", getMenuItem);
router.get("/category/slug/:categorySlug", getMenuItemsByCategorySlug);

module.exports = router;
