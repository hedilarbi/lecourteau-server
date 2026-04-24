const express = require("express");
const {
  getInititalStats,
  getRestaurantStats,
  getAnalyticsStats,
  getPaymentSummaryReport,
  testNotif,
} = require("../controllers/stats");
const authStaff = require("../middlewares/authStaff");
const router = express.Router();

router.get("/initial", authStaff, getInititalStats);
router.get("/initial/:id", authStaff, getRestaurantStats);
router.get("/analytics", authStaff, getAnalyticsStats);
router.get("/report/payment-summary", getPaymentSummaryReport);
router.get("/test", testNotif);

module.exports = router;
