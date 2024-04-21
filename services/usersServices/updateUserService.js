const User = require("../../models/User");

const updateUserService = async (id, email, name) => {
  try {
    const response = await User.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: name,
          email: email,
        },
      },
      { new: true } // This option returns the updated user
    );

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  updateUserService,
};
