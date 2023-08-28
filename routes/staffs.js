const express = require("express");
const {
  createStaff,
  loginStaff,
  getStaffByToken,
} = require("../controllers/staffs");

const router = express.Router();

router.post("/create", createStaff);
router.post("/login", loginStaff);
router.get("/staffByToken", getStaffByToken);

module.exports = router;
