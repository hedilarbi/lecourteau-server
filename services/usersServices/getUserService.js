const User = require("../../models/User");

const getUserService = async (id) => {
  const user = await User.findById(id).populate("orders");
  return user;
};

module.exports = {
  getUserService,
};
