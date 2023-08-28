const express = require("express");
const {
  createOffer,
  getOffers,
  getOffer,
  deleteOffer,
  updateOffer,
} = require("../controllers/offers");
const router = express.Router();

router.get("/", getOffers);
router.post("/create", createOffer);
router.delete("/delete/:id", deleteOffer);
router.put("/update/:id", updateOffer);
router.get("/:id", getOffer);

module.exports = router;
