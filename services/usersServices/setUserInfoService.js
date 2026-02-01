const User = require("../../models/User");

const setUserInfoService = async (
  id,
  address,
  email,
  name,
  coords,
  date_of_birth
) => {
  try {
    let newAddress;
    if (address.length > 0 && coords.longitude) {
      newAddress = {
        address,
        coords,
      };
    }

    const response = await User.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: name,
          email: email,
          is_profile_setup: true,
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        },
        $push: {
          addresses: newAddress,
        },
      },
      { new: true }
    );

    return { response };
  } catch (err) {
    console.log("Error in setUserInfoService:", err);
    return { error: err.message };
  }
};

module.exports = {
  setUserInfoService,
};
