const express = require("express");
const {
  createHomeSetting,
  getHomeSettings,
  updateHomeSetting,
  deleteHomeSetting,
} = require("../controllers/homeSettings");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");

const router = express.Router();

router.get("/", getHomeSettings);
router.post(
  "/create",
  Multer.single("file"),
  optimizeImage,
  uploadImageToFirebase,
  createHomeSetting,
);
router.put(
  "/update/:id",
  Multer.single("file"),
  optimizeImage,
  updateMenuItemImageInFirebase,
  updateHomeSetting,
);
router.delete("/delete/:id", deleteHomeSetting);

module.exports = router;
