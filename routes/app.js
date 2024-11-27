const express = require("express");

const { getApp, createApp, updateApp } = require("../controllers/app");

const router = express.Router();

router.get("/", getApp);
router.post("/", createApp);
router.put("/:id", updateApp);

module.exports = router;
