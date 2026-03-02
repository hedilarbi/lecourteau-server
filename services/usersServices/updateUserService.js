const User = require("../../models/User");

const updateUserService = async (id, email, name, date_of_birth) => {
  try {
    const updateData = {
      name,
      email,
    };

    if (date_of_birth) {
      const parsedDate = new Date(date_of_birth);
      if (!Number.isNaN(parsedDate.getTime())) {
        updateData.date_of_birth = parsedDate;
      }
    }

    const response = await User.findOneAndUpdate(
      { _id: id },
      {
        $set: updateData,
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
