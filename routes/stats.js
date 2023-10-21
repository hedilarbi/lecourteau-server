const express = require("express");
const { getInititalStats } = require("../controllers/stats");
const router = express.Router();

router.get("/initial", getInititalStats);

module.exports = router;
