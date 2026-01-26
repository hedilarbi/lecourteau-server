const express = require("express");

const router = express.Router();

const { getAllAudits, deleteAllAudits } = require("../controllers/audit");
const authStaff = require("../middlewares/authStaff");

router.get("/", authStaff, getAllAudits);

module.exports = router;
