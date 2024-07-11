const express = require("express");
const {
  createPayment,
  createSetupIntent,
  getPaymentMethods,
} = require("../controllers/payments");

const router = express.Router();

router.post("/create-payment-intent", createPayment);
router.post("/create-setup-intent", createSetupIntent);
router.get("/get-payment-methods/:customerId", getPaymentMethods);

module.exports = router;
