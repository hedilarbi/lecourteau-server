const express = require("express");
const {
  createOrder,
  getOrders,
  getOrder,
  deleteOrder,
  updateStatus,
  updatePrice,
  reviewOrder,
} = require("../controllers/orders");
const router = express.Router();

router.get("/", getOrders);
router.post("/create", createOrder);
router.delete("/delete/:id", deleteOrder);
router.put("/review/:id", reviewOrder);
router.put("/update/status/:id", updateStatus);
router.put("/update/price/:id", updatePrice);
router.get("/:id", getOrder);

module.exports = router;
