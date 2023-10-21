const express = require("express");
const {
  createToppingCategory,
  getToppingCategories,
  getToppingCategory,
  updateToppingCategory,
  deleteToppingCategory,
} = require("../controllers/toppingCategory");
const { uploadImageToFirebase } = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");

const router = express.Router();

router.get("/", getToppingCategories);
router.post(
  "/create",
  Multer.single("file"),
  optimizeImage,
  uploadImageToFirebase,
  createToppingCategory
);
router.get("/:id", getToppingCategory);
router.put("/update/:id", updateToppingCategory);
router.delete("/delete/:id", deleteToppingCategory);

module.exports = router;
