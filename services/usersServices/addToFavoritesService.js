const User = require("../../models/User");

const addToFavoritesService = async (userId, itemId) => {
  const user = await User.findById(userId);
  console.log(user);
  if (!user) {
    return { error: "User not found" };
  }
  if (user.favorites.includes(itemId)) {
    return { error: "Favorite already exists" };
  }
  user.favorites.push(itemId);
  await user.save();
  return { user };
};

module.exports = {
  addToFavoritesService,
};
