const express = require("express");
const { createSize, getSizes, deleteSize } = require("../controllers/sizes");

const router = express.Router();

router.post("/", createSize);
router.get("/", getSizes);
router.delete("/:id", deleteSize);

module.exports = router;
