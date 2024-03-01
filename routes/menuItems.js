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
} = require("../controllers/menuItems");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");
const router = express.Router();

router.get("/", getMenuItems);

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
router.delete("/delete/:id", deleteMenuItem);
router.get("/category/:id", getMenuItemsByCategory);
router.get("/:id", getMenuItem);

module.exports = router;
