const express = require("express");
const {
  getInititalStats,
  getRestaurantStats,
} = require("../controllers/stats");
const router = express.Router();

router.get("/initial", getInititalStats);
router.get("/initial/:id", getRestaurantStats);

module.exports = router;
