const User = require("../../models/User");

const removeFromFavoritesService = async (userId, itemId) => {
  try {
    const user = await User.findById(userId);
    const itemIndex = user.favorites.indexOf(itemId);
    if (itemIndex > -1) {
      user.favorites.splice(itemIndex, 1);
      await user.save();
    } else {
      return { error: "Favorite not found" };
    }
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  removeFromFavoritesService,
};
