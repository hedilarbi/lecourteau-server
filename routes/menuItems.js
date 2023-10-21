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
} = require("../controllers/menuItems");
const { uploadImageToFirebase } = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");
const router = express.Router();

router.get("/", getMenuItems);
router.get("/name", getItemsNames);
router.post("/create",  Multer.single("file"),
optimizeImage,
uploadImageToFirebase,createMenuItem);
router.put("/update/:id", updateMenuItem);
router.put("update/availability/:id", updateMenuItemAvailability);
router.delete("/delete/:id", deleteMenuItem);
router.get("/category/:id", getMenuItemsByCategory);
router.get("/:id", getMenuItem);

module.exports = router;
