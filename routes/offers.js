const express = require("express");
const {
  createOffer,
  getOffers,
  getOffer,
  deleteOffer,
  updateOffer,
} = require("../controllers/offers");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");
const router = express.Router();

router.get("/", getOffers);
router.post(
  "/create",
  Multer.single("file"),
  optimizeImage,
  uploadImageToFirebase,
  createOffer
);
router.delete("/delete/:id", deleteOffer);
router.put("/update/:id", updateOffer);
router.get("/:id", getOffer);

module.exports = router;
