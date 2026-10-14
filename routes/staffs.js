const express = require("express");
const {
  createStaff,
  loginStaff,
  getStaffByToken,
  deleteStaffMember,
  getStaffMembers,
  getStaffMember,
  updateStaffMember,
  affectOrderToStaff,
  getAvailableDrivers,
  getStaffOrder,
  getDriverOrders,
  updatePassword,
} = require("../controllers/staffs");
const {
  uploadImageToFirebase,
  updateMenuItemImageInFirebase,
} = require("../firebase");
const Multer = require("../middlewares/multer");
const { optimizeImage } = require("../middlewares/imageOptimizor");
const authStaff = require("../middlewares/authStaff");
const requireStaffRole = require("../middlewares/requireStaffRole");
const { requireStaffSelfOrRole } = requireStaffRole;
const router = express.Router();

router.get("/", authStaff, requireStaffRole("admin"), getStaffMembers);

router.get("/available", getAvailableDrivers);
router.put(
  "/update/:id",
  authStaff,
  requireStaffRole("admin"),
  Multer.single("file"),
  updateStaffMember
);
router.post(
  "/create",
  authStaff,
  requireStaffRole("admin"),
  Multer.single("file"),

  uploadImageToFirebase,
  createStaff
);
router.get("/:id/order", getStaffOrder);
router.put("/affectOrder/:id", authStaff, requireStaffRole(), affectOrderToStaff);
router.put(
  "/updatePassword/:id",
  authStaff,
  requireStaffRole("admin"),
  updatePassword
);
router.post("/login", loginStaff);
router.get("/driver/orders/:id", getDriverOrders);
router.get("/staffByToken", getStaffByToken);
router.delete(
  "/delete/:id",
  authStaff,
  requireStaffRole("admin"),
  deleteStaffMember
);
router.get("/:id", authStaff, requireStaffSelfOrRole("admin"), getStaffMember);

module.exports = router;
