const express = require("express");
const {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  addToFavorites,
  deleteFromFavorites,
  addToAddresses,
  deleteFromAddresses,
} = require("../controllers/customers");
const router = express.Router();

router.get("/", getCustomers);
router.post("/create", createCustomer);
router.put("/update/favorites/:id", addToFavorites);
router.put("/update/addresses/:id", addToAddresses);
router.delete("/delete/favorites/:id", deleteFromFavorites);
router.delete("/:id/delete/addresses/:addressId", deleteFromAddresses);
router.put("/update/:id", updateCustomer);
router.delete("/delete/:id", deleteCustomer);
router.get("/:id", getCustomer);

module.exports = router;
