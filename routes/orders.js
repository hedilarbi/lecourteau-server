const express = require("express");
const {
  createOrder,
  getOrders,
  getOrder,
  deleteOrder,
  updateStatus,
  updatePrice,
  reviewOrder,
  orderDelivered,
  updatePriceAndStatus,

  confirmOrder,
} = require("../controllers/orders");
const router = express.Router();

router.get("/", getOrders);

router.put("/confirm/:id", confirmOrder);
router.post("/create", createOrder);
router.delete("/delete/:id", deleteOrder);
router.put("/review/:id", reviewOrder);
router.put("/update/status/:id", updateStatus);
router.put("/update/delivered/:orderId", orderDelivered);
router.put("/update/price/:id", updatePrice);
router.put("/update/priceandstatus/:id", updatePriceAndStatus);
router.get("/:id", getOrder);

module.exports = router;
