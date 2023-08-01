const express = require("express");
const {
  createToppingCategory,
  getToppingCategories,
  getToppingCategory,
  updateToppingCategory,
  deleteToppingCategory,
} = require("../controllers/toppingCategory");

const router = express.Router();

router.get("/", getToppingCategories);
router.post("/create", createToppingCategory);
router.get("/:id", getToppingCategory);
router.put("/update/:id", updateToppingCategory);
router.delete("/delete/:id", deleteToppingCategory);

module.exports = router;
