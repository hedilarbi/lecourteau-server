const User = require("../../models/User");

const getUsersService = async () => {
  try {
    let response = await User.find().select("name phone_number email");
    response = response.reverse();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getUsersService,
};
