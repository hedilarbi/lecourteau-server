const User = require("../../models/User");
const { getUserService } = require("./getUserService");

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

    await User.findOneAndUpdate(
      { _id: id },
      {
        $set: updateData,
      },
      { new: true } // This option returns the updated user
    );

    const { response, error } = await getUserService(id);
    if (error) return { error };

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  updateUserService,
};
