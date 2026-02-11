const express = require("express");
const authStaff = require("../middlewares/authStaff");
const {
  getUberDirectAccessToken,
  createQuote,
  createDelivery,
  listDeliveries,
  getDelivery,
  updateDelivery,
  cancelDelivery,
  getProofOfDelivery,
  handleUberDirectWebhook,
  findStores,
} = require("../controllers/uberDirect");

const router = express.Router();

router.post("/webhooks/events", handleUberDirectWebhook);
router.post("/auth/token", authStaff, getUberDirectAccessToken);
router.post(
  "/restaurants/:restaurantId/orders/:orderId/quotes",
  authStaff,
  createQuote
);
router.post(
  "/restaurants/:restaurantId/orders/:orderId/deliveries",
  authStaff,
  createDelivery
);
router.get("/restaurants/:restaurantId/deliveries", authStaff, listDeliveries);
router.get(
  "/restaurants/:restaurantId/deliveries/:deliveryId",
  authStaff,
  getDelivery
);
router.post(
  "/restaurants/:restaurantId/deliveries/:deliveryId",
  authStaff,
  updateDelivery
);
router.post(
  "/restaurants/:restaurantId/deliveries/:deliveryId/cancel",
  authStaff,
  cancelDelivery
);
router.post(
  "/restaurants/:restaurantId/deliveries/:deliveryId/proof-of-delivery",
  authStaff,
  getProofOfDelivery
);
router.get("/restaurants/:restaurantId/stores", authStaff, findStores);

module.exports = router;
