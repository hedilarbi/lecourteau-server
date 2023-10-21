const express = require("express");
const {
  createTopping,
  getToppings,
  deleteTopping,
  updateTopping,
  getTopping,
} = require("../controllers/toppings");
const { uploadImageToFirebase } = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");

const router = express.Router();

router.get("/", getToppings);
router.post(
  "/create",
  Multer.single("file"),
  optimizeImage,
  uploadImageToFirebase,
  createTopping
);
router.put("/update/:id", updateTopping);
router.delete("/delete/:id", deleteTopping);
router.get("/:id", getTopping);

module.exports = router;
