const User = require("../../models/User");
const { getUserService } = require("./getUserService");

const setUserInfoService = async (
  id,
  address,
  email,
  name,
  coords,
  date_of_birth,
) => {
  try {
    const hasAddress =
      typeof address === "string" &&
      address.trim().length > 0 &&
      Number.isFinite(Number(coords?.latitude)) &&
      Number.isFinite(Number(coords?.longitude));

    const updateQuery = {
      $set: {
        name: name,
        email: email,
        is_profile_setup: true,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      },
    };

    if (hasAddress) {
      updateQuery.$push = {
        addresses: {
          address,
          coords,
        },
      };
    }

    await User.findOneAndUpdate(
      { _id: id },
      updateQuery,
      { new: true },
    );

    const { response, error } = await getUserService(id);
    if (error) return { error };

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  setUserInfoService,
};
