const User = require("../../models/User");

const deleteUserService = async (id) => {
  await User.findByIdAndDelete(id);
};

module.exports = {
  deleteUserService,
};
