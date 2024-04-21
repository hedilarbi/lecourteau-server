const User = require("../../models/User");

const addToFavoritesService = async (userId, itemId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return { error: "User not found" };
    }
    if (user.favorites.includes(itemId)) {
      return { error: "Favorite already exists" };
    }
    user.favorites.push(itemId);
    await user.save();
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  addToFavoritesService,
};
