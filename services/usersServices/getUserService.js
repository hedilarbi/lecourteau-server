const User = require("../../models/User");

const getUserService = async (id) => {
  try {
    const response = await User.findById(id).populate("orders");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getUserService,
};
