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
  getSubscriptionAdminStats,
  getSubscriptionAdminUserDetails,
  createHediPayout,
} = require("../controllers/subscriptions");
const authStaff = require("../middlewares/authStaff");

const router = express.Router();

router.post("/webhook", handleStripeWebhook);
router.get("/config", getSubscriptionConfig);
router.put("/config", authStaff, updateSubscriptionConfig);
router.get("/user/:userId", getUserSubscription);
router.post("/create", createSubscription);
router.post("/confirm-payment", confirmSubscriptionPayment);
router.post("/auto-renew", setSubscriptionAutoRenew);
router.post("/cancel", cancelSubscription);
router.post("/refresh/:userId", refreshUserSubscription);
router.get("/admin/stats", authStaff, getSubscriptionAdminStats);
router.get("/admin/user/:userId", authStaff, getSubscriptionAdminUserDetails);
router.post("/admin/hedi-payout", authStaff, createHediPayout);

module.exports = router;
