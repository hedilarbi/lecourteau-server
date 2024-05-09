const express = require("express");
const {
  createLocalOrder,
  getLocalOrders,
  getLocalOrder,
} = require("../controllers/localOrders");

const router = express.Router();

router.post("/", createLocalOrder);
router.get("/", getLocalOrders);
router.get("/:id", getLocalOrder);

module.exports = router;
