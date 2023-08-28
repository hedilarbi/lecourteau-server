const express = require("express");

const {
  createReward,
  getRewards,
  deleteReward,
} = require("../controllers/rewards");

const router = express.Router();

router.get("/", getRewards);
router.post("/create", createReward);
router.delete("/delete/:id", deleteReward);

module.exports = router;
