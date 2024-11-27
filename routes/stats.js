const express = require("express");
const {
  getInititalStats,
  getRestaurantStats,
  testNotif,
} = require("../controllers/stats");
const router = express.Router();

router.get("/initial", getInititalStats);
router.get("/initial/:id", getRestaurantStats);
router.get("test", testNotif);

module.exports = router;
