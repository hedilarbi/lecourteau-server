const express = require("express");

const {
  createToppingGroup,
  getToppingGroup,
  listToppingGroups,
  updateToppingGroup,
  deleteToppingGroup,
} = require("../controllers/toppingGroups");
const router = express.Router();

router.get("/", listToppingGroups);
router.post("/", createToppingGroup);
router.get("/:id", getToppingGroup);
router.delete("/:id", deleteToppingGroup);
router.put("/:id", updateToppingGroup);

module.exports = router;
