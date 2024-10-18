const express = require("express");
const {
  createPayment,
  createSetupIntent,
  getPaymentMethods,
  verifyPayment,
} = require("../controllers/payments");

const router = express.Router();

router.post("/create-payment-intent", createPayment);
router.post("/create-setup-intent", createSetupIntent);
router.get("/get-payment-methods/:customerId", getPaymentMethods);
router.get("/verify-payment", verifyPayment);

module.exports = router;
