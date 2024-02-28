const express = require("express");
const { sendNotifications, sendSMSs } = require("../controllers/notifiers");
const router = express.Router();

router.post("/notifications", sendNotifications);
router.post("/sms", sendSMSs);
router.post("/emails", sendSMSs);

module.exports = router;
