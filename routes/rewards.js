const express = require("express");

const {
  createReward,
  getRewards,
  updateReward,
  deleteReward,
} = require("../controllers/rewards");

const router = express.Router();

router.get("/", getRewards);
router.post("/create", createReward);
router.put("/update/:id", updateReward);
router.delete("/delete/:id", deleteReward);

module.exports = router;
