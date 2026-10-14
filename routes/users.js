const express = require("express");
const {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUserStats,
  getUsers,
  addToFavorites,

  addToAddresses,
  deleteFromAddresses,
  getFavorites,
  removeFromFavorites,
  getUserByToken,
  getOrdersList,
  setUserInfo,
  updateUserExpoToken,
  dismissBirthdayDobPrompt,
  dismissFirstOrderDiscountPrompt,
  savePayementDetails,
  getUsersPagination,
  banUser,
  unsubscribeFromMail,
  sendEmailVerificationOtp,
  verifyEmailOtp,
} = require("../controllers/users");
const authUser = require("../middlewares/authUser");
const authStaff = require("../middlewares/authStaff");
const requireStaffRole = require("../middlewares/requireStaffRole");
const authUserOrStaffRole = require("../middlewares/authUserOrStaffRole");
const router = express.Router();

router.get("/", authStaff, requireStaffRole("admin", "Caissier"), getUsers);
router.get(
  "/pagination",
  authStaff,
  requireStaffRole("admin", "Caissier"),
  getUsersPagination,
);
router.get("/userByToken", getUserByToken);
router.post("/desabonnement", unsubscribeFromMail);
router.post("/email-verification/send", authUser, sendEmailVerificationOtp);
router.post("/email-verification/verify", authUser, verifyEmailOtp);

router.post("/create", createUser);
router.get("/favorites/:id", getFavorites);
router.put("/favorites/update/add/:id", addToFavorites);
router.put("/card/add/:id", savePayementDetails);
router.put("/ban/:id", authStaff, requireStaffRole("admin"), banUser);
router.put("/favorites/update/remove/:id", removeFromFavorites);
router.put("/addresses/update/add/:id", addToAddresses);
router.put("/update/expoToken/:id", updateUserExpoToken);
router.put("/update/birthday-dob-prompt/:id", dismissBirthdayDobPrompt);
router.put(
  "/update/first-order-discount-prompt/:id",
  dismissFirstOrderDiscountPrompt,
);
router.put("/:id/delete/addresses/:addressId", deleteFromAddresses);
router.delete("/:id/addresses/:addressId", deleteFromAddresses);
router.get("/orders/:id", getOrdersList);
router.put("/update/:id", authUser, updateUser);
router.put("/set/:id", authUser, setUserInfo);
router.delete("/delete/:id", authUserOrStaffRole("admin"), deleteUser);
router.get("/stats/:id", getUserStats);
router.get("/:id", authUserOrStaffRole(), getUser);

module.exports = router;
