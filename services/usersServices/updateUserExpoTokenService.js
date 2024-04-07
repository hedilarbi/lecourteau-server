const User = require("../../models/User");

const updateUserExpoTokenService = async (id, expoToken) => {
  const user = await User.findById(id);
  if (!user) {
    return { error: "User not found" };
  }
  user.expoToken = expoToken;
  await user.save();
  return { user };
};

module.exports = {
  updateUserExpoTokenService,
};
