const express = require("express");
const {
  createTable,
  getTables,
  getTable,
  addItemToTableBasket,
  removeItemFromTableBasket,
  clearTableBasket,
  updateItemInTableBasket,
  getTableBasket,
} = require("../controllers/tables");
const router = express.Router();

router.post("/", createTable);
router.get("/", getTables);
router.get("/:number", getTable);
router.get("/:number/basket", getTableBasket);
router.put("/:number/add", addItemToTableBasket);
router.put("/:number/remove", removeItemFromTableBasket);
router.put("/:number/clear", clearTableBasket);
router.put("/:number/update", updateItemInTableBasket);

module.exports = router;
