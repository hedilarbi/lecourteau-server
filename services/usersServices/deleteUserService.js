const User = require("../../models/User");

const deleteUserService = async (id) => {
  try {
    await User.findByIdAndDelete(id);
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  deleteUserService,
};
