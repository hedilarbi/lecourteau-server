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
  updateUserDiscount,
  savePayementDetails,
  getUsersPagination,
  banUser,
  nullifyDefaultBirthdates,
} = require("../controllers/users");
const router = express.Router();

router.get("/", getUsers);
router.get("/pagination", getUsersPagination);
router.get("/userByToken", getUserByToken);
router.put("/admin/nullify-default-birthdates", nullifyDefaultBirthdates);
router.put("/update/discount", updateUserDiscount);
router.post("/create", createUser);
router.get("/favorites/:id", getFavorites);
router.put("/favorites/update/add/:id", addToFavorites);
router.put("/card/add/:id", savePayementDetails);
router.put("/ban/:id", banUser);
router.put("/favorites/update/remove/:id", removeFromFavorites);
router.put("/addresses/update/add/:id", addToAddresses);
router.put("/update/expoToken/:id", updateUserExpoToken);
router.put("/update/birthday-dob-prompt/:id", dismissBirthdayDobPrompt);
router.put(
  "/update/first-order-discount-prompt/:id",
  dismissFirstOrderDiscountPrompt,
);
router.put("/:id/delete/addresses/:addressId", deleteFromAddresses);
router.get("/orders/:id", getOrdersList);
router.put("/update/:id", updateUser);
router.put("/set/:id", setUserInfo);
router.delete("/delete/:id", deleteUser);
router.get("/stats/:id", getUserStats);
router.get("/:id", getUser);

module.exports = router;
