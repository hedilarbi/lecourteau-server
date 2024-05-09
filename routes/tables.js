const express = require("express");
const {
  createTable,
  getTables,
  getTable,
  addItemToTableBasket,
  removeItemWithIDFromTableBasket,
  clearTableBasket,
  updateItemInTableBasket,
  getTableBasket,
  removeItemWithUIDFromTableBasket,
  getItemFromBasket,
} = require("../controllers/tables");
const router = express.Router();

router.post("/", createTable);
router.get("/", getTables);
router.get("/:number", getTable);
router.get("/:number/basket", getTableBasket);
router.put("/:number/basket/add", addItemToTableBasket);
router.put("/:number/basket/removeWithID", removeItemWithIDFromTableBasket);
router.put("/:number/basket/removeWithUID", removeItemWithUIDFromTableBasket);
router.put("/:number/basket/clear", clearTableBasket);
router.put("/:number/basket/update", updateItemInTableBasket);
router.get("/:number/basket/item/:uid", getItemFromBasket);

module.exports = router;
