const express = require("express");
const {
  createRestaurant,
  getRestaurants,
  getRestaurant,
  deleteRestaurant,
  updateRestaurant,
  getRestaurantItems,
  getRestaurantToppings,
  getRestaurantOffers,
  getRestaurantOrders,
  updateRestaurantItemAvailability,
  updateRestaurantOfferAvailability,
  updateRestaurantToppingAvailability,
  getRestaurantMenuItem,
} = require("../controllers/restaurants");
const router = express.Router();

router.post("/create", createRestaurant);
router.get("/", getRestaurants);
router.get("/:id", getRestaurant);
router.get("/items/:id", getRestaurantItems);
router.get("/toppings/:id", getRestaurantToppings);
router.get("/offers/:id", getRestaurantOffers);
router.get("/orders/:id", getRestaurantOrders);
router.delete("/delete/:id", deleteRestaurant);
router.put("/update/:id", updateRestaurant);
router.get("/:restaurantId/items/:id", getRestaurantMenuItem);
router.put("/:id/items/:itemId", updateRestaurantItemAvailability);
router.put("/:id/offers/:offerId", updateRestaurantOfferAvailability);
router.put("/:id/toppings/:toppingId", updateRestaurantToppingAvailability);

module.exports = router;
