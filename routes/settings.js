const express = require("express");
const { getSetting, updateSettings } = require("../controllers/settings");

const router = express.Router();

router.get("/", getSetting);
router.put("/update/:id", updateSettings);

module.exports = router;
