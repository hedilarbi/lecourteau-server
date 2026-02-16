const express = require("express");
const { getHomeContent } = require("../controllers/home");

const router = express.Router();

router.get("/content", getHomeContent);

module.exports = router;
