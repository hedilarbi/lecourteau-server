const express = require("express");
const router = express.Router();
const {
  getRules,
  createOrUpdateRule,
  getActiveOffer,
  getLastExpiredOffer,
  logEvent,
  getUserProfiles,
  getOffersHistory,
  deleteRule,
  triggerScan,
  initializeBasketRules,
  getCronStatus,
  toggleCron,
  getSmartOfferHediStats,
  createSmartOfferHediPayout,
  getMonitoringStats,
  unsubscribeEmail,
} = require("../controllers/personalizedOffer");
const authStaff = require("../middlewares/authStaff");
const requireStaffRole = require("../middlewares/requireStaffRole");

// Unsubscribe route (Public/Unsecured so email links work directly without login)
router.get("/unsubscribe", unsubscribeEmail);
router.get("/unsubscribe/:userId", unsubscribeEmail);

// Rules Configuration
router.get("/rules", getRules);
router.post("/rules", createOrUpdateRule);
router.delete("/rules/:id", deleteRule);

// User profiles & history (Dashboard)
router.get("/profiles", getUserProfiles);
router.get("/history", getOffersHistory);
router.get("/monitoring-stats", getMonitoringStats);
router.post("/trigger-scan", authStaff, requireStaffRole("admin"), triggerScan);
router.post("/rules/initialize-basket", authStaff, initializeBasketRules);
// Arrêt / reprise du système smart offers : réservé aux admins.
router.get("/cron/status", authStaff, requireStaffRole("admin"), getCronStatus);
router.post("/cron/toggle", authStaff, requireStaffRole("admin"), toggleCron);

// Client API
router.get("/active/:userId", getActiveOffer);
router.get("/last-expired/:userId", getLastExpiredOffer);
router.post("/event", logEvent);

// Admin Hedi Royalties & Payouts
router.get("/hedi-stats", authStaff, getSmartOfferHediStats);
router.post("/hedi-payout", authStaff, createSmartOfferHediPayout);

module.exports = router;
