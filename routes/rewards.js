const express = require("express");

const { createReward, getRewards } = require("../controllers/rewards");

const router = express.Router();

router.get("/", getRewards);
router.post("/create", createReward);

module.exports = router;
