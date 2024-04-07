const User = require("../../models/User");

const updateUserService = async (id, email, name) => {
  const updatedUser = await User.findOneAndUpdate(
    { _id: id },
    {
      $set: {
        name: name,
        email: email,
      },
    },
    { new: true } // This option returns the updated user
  );

  return updatedUser;
};

module.exports = {
  updateUserService,
};
