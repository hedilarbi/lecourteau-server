const express = require("express");
const { sendCampaignMail, getCampaignMailStatus } = require("../controllers/mailCampaign");

const router = express.Router();
router.get("/send", sendCampaignMail);
router.get("/status", getCampaignMailStatus);
module.exports = router;
