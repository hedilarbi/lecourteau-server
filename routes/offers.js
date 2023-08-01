const express = require("express");
const { createOffer, getOffers } = require("../controllers/offers");
const router = express.Router();

router.get("/", getOffers);
router.post("/create", createOffer);

module.exports = router;
