const express = require("express");
const {
  createStaff,
  loginStaff,
  getStaffByToken,
  deleteStaffMember,
  getStaffMembers,
  getStaffMember,
  updateStaffMember,
} = require("../controllers/staffs");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");
const router = express.Router();

router.get("/", getStaffMembers);
router.put("/update/:id", updateStaffMember);
router.post(
  "/create",
  Multer.single("file"),

  uploadImageToFirebase,
  createStaff
);

router.post("/login", loginStaff);
router.get("/staffByToken", getStaffByToken);
router.delete("/delete/:id", deleteStaffMember);
router.get("/:id", getStaffMember);

module.exports = router;
