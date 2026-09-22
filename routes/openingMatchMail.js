const express = require("express");
const { sendOpeningMatchMail, getOpeningMatchMailStatus } = require("../controllers/openingMatchMail");

const router = express.Router();
router.get("/send", sendOpeningMatchMail);
router.get("/status", getOpeningMatchMailStatus);
module.exports = router;
