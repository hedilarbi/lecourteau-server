const express = require("express");
const {
  handleStripeWebhook,
  getSubscriptionConfig,
  updateSubscriptionConfig,
  getUserSubscription,
  createSubscription,
  confirmSubscriptionPayment,
  setSubscriptionAutoRenew,
  cancelSubscription,
  refreshUserSubscription,
} = require("../controllers/subscriptions");

const router = express.Router();

router.post("/webhook", handleStripeWebhook);
router.get("/config", getSubscriptionConfig);
router.put("/config", updateSubscriptionConfig);
router.get("/user/:userId", getUserSubscription);
router.post("/create", createSubscription);
router.post("/confirm-payment", confirmSubscriptionPayment);
router.post("/auto-renew", setSubscriptionAutoRenew);
router.post("/cancel", cancelSubscription);
router.post("/refresh/:userId", refreshUserSubscription);

module.exports = router;
