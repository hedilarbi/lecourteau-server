const express = require("express");
const router = express.Router();
const {
  createPromoCode,
  getPromoCodes,
  getPromoCodeById,
  updatePromoCode,
  deletePromoCode,
  verifyPromoCode,
} = require("../controllers/promoCode");

router.post("/create", createPromoCode);
router.get("/", getPromoCodes);
router.get("/:id", getPromoCodeById);
router.put("/:id", updatePromoCode);
router.delete("/:id", deletePromoCode);
router.post("/verify", verifyPromoCode);

module.exports = router;
