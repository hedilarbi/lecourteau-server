const User = require("../../models/User");

const getFavoritesService = async (id) => {
  const user = await User.findById(id)
    .select("favorites")
    .populate({ path: "favorites", select: "name image" });
  if (!user) {
    return { error: "User not found" };
  }
  return { user };
};

module.exports = {
  getFavoritesService,
};
