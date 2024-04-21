const User = require("../../models/User");
const jwt = require("jsonwebtoken");

const getUserByTokenService = async (token) => {
  try {
    const decodedData = jwt.verify(token, process.env.SECRET_KEY);
    const user = await User.findById(decodedData.id);

    if (!user) {
      return { error: "User not found" };
    }
    return { user, error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getUserByTokenService,
};
