const User = require("../../models/User");

const getFavoritesService = async (id) => {
  try {
    const user = await User.findById(id)
      .select("favorites")
      .populate({ path: "favorites", select: "name image" });
    if (!user) {
      return { error: "User not found" };
    }
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getFavoritesService,
};
