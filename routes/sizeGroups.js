const express = require("express");

const {
  createSizesGroup,
  getSizesGroups,
  getSizesGroup,
  updateSizesGroup,
  deleteSizesGroup,
} = require("../controllers/sizesGroup");
const router = express.Router();

router.get("/", getSizesGroups);
router.post("/", createSizesGroup);
router.get("/:id", getSizesGroup);
router.delete("/:id", deleteSizesGroup);
router.put("/:id", updateSizesGroup);

module.exports = router;
