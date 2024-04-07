const User = require("../../models/User");

const getUsersService = async () => {
  let users = await User.find().select("name phone_number email");
  users = users.reverse();
  return users;
};

module.exports = {
  getUsersService,
};
