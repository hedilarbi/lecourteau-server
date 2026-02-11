const express = require("express");
const {
  createOrder,
  getOrders,
  getOrder,
  deleteOrder,
  updateStatus,
  updateDeliveryProvider,
  updatePrice,
  reviewOrder,
  orderDelivered,
  updatePriceAndStatus,

  confirmOrder,
  updateOrderPaymentStatus,
  getFilteredOrders,
  getRestaurantFilteredOrders,
  orderChecker,
  getTotalRevenue,
} = require("../controllers/orders");
const authStaff = require("../middlewares/authStaff");
const router = express.Router();

router.get("/", getOrders);
router.get("/total-revenu", getTotalRevenue);
router.get("/checkOrders/:id", orderChecker);
router.put("/confirm/:id", authStaff, confirmOrder);
router.post("/create", createOrder);
router.get("/filter", getFilteredOrders);
router.get("/filter/:id", getRestaurantFilteredOrders);
router.delete("/delete/:id", deleteOrder);
router.put("/review/:id", reviewOrder);
router.put("/update/status/:id", authStaff, updateStatus);
router.put("/update/delivery_provider/:id", authStaff, updateDeliveryProvider);
router.put("/update/delivered/:orderId", orderDelivered);
router.put("/update/price/:id", updatePrice);
router.put("/update/payment_status/:id", updateOrderPaymentStatus);
router.put("/update/priceandstatus/:id", updatePriceAndStatus);
router.get("/:id", getOrder);

module.exports = router;
