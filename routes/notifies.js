const express = require("express");
const {
  sendNotifications,
  sendSMSs,
  testNotification,
} = require("../controllers/notifiers");
const router = express.Router();

router.post("/notifications", sendNotifications);
router.post("/sms", sendSMSs);
router.post("/emails", sendSMSs);
router.post("/test", testNotification);

module.exports = router;
