const express = require("express");
const {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUsers,
  addToFavorites,

  addToAddresses,
  deleteFromAddresses,
  getFavorites,
  removeFromFavorites,
  getUserByToken,
} = require("../controllers/users");
const router = express.Router();

router.get("/", getUsers);
router.get("/userByToken", getUserByToken);
router.post("/create", createUser);
router.get("/favorites/:id", getFavorites);
router.put("/favorites/update/add/:id", addToFavorites);
router.put("/favorites/update/remove/:id", removeFromFavorites);
router.put("/addresses/:id", addToAddresses);

router.put("/:id/delete/addresses/:addressId", deleteFromAddresses);
router.put("/update/:id", updateUser);
router.delete("/delete/:id", deleteUser);
router.get("/:id", getUser);

module.exports = router;
