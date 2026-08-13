const express = require("express");
const {
  createPayment,
  createPlatformPaymentIntent,
  createSetupIntent,
  getPaymentMethods,
  verifyPayment,
  catchError,
  confirmPayment,
  cancelPayment,
  deletePaymentMethod,
  attachPaymentMethod,
  updatePaymentMethod,
} = require("../controllers/payments");

const router = express.Router();

router.post("/create-payment-intent", createPayment);
router.post("/create-platform-payment-intent", createPlatformPaymentIntent);
router.post("/create-setup-intent", createSetupIntent);
router.get("/get-payment-methods/:customerId", getPaymentMethods);
router.get("/verify-payment", verifyPayment);
router.post("/catch-error", catchError);
router.post("/confirm-payment", confirmPayment);
router.post("/cancel-payment-intent", cancelPayment);
router.delete("/payment-method/:paymentMethodId", deletePaymentMethod);
router.put("/payment-method/:paymentMethodId", updatePaymentMethod);
router.post("/attach-payment-method", attachPaymentMethod);

module.exports = router;
