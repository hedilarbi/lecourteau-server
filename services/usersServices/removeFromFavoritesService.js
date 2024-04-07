// userService.js
const User = require("../../models/User");

// ... existing code ...

const removeFromFavoritesService = async (userId, itemId) => {
  const user = await User.findById(userId);
  const itemIndex = user.favorites.indexOf(itemId);
  if (itemIndex > -1) {
    user.favorites.splice(itemIndex, 1);
    await user.save();
  } else {
    return { error: "Favorite not found" };
  }
  return { user };
};

module.exports = {
  removeFromFavoritesService,
};
