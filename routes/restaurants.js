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
  getRestaurantOffer,
  setSettings,
  getRestaurantsSettings,
  updateRestaurantSettings,
  getRestaurantsList,
  getRestaurantSettings,
  updateEmploie,
} = require("../controllers/restaurants");
const router = express.Router();

router.post("/create", createRestaurant);
router.get("/settings", getRestaurantsSettings);
router.get("/settings/:id", getRestaurantSettings);
router.get("/", getRestaurants);
router.put("/", setSettings);
router.put("/emploie", updateEmploie);
router.get("/list", getRestaurantsList);
router.get("/:id", getRestaurant);
router.get("/items/:id", getRestaurantItems);
router.put("/update/settings/:id", updateRestaurantSettings);
router.get("/toppings/:id", getRestaurantToppings);
router.get("/offers/:id", getRestaurantOffers);
router.get("/orders/:id", getRestaurantOrders);
router.delete("/delete/:id", deleteRestaurant);
router.put("/update/:id", updateRestaurant);
router.get("/:restaurantId/items/:id", getRestaurantMenuItem);
router.get("/:restaurantId/offer/:id", getRestaurantOffer);
router.put("/:id/items/:itemId", updateRestaurantItemAvailability);
router.put("/:id/offers/:offerId", updateRestaurantOfferAvailability);
router.put("/:id/toppings/:toppingId", updateRestaurantToppingAvailability);

module.exports = router;
