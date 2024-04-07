const User = require("../../models/User");

const setUserInfoService = async (
  id,
  address,
  email,
  name,
  coords,
  date_of_birth
) => {
  let newAddress;
  if (address.length > 0 && coords.longitude) {
    newAddress = {
      address,
      coords,
    };
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: id },
    {
      $set: {
        name: name,
        email: email,
        is_profile_setup: true,
        date_of_birth: new Date(date_of_birth),
      },
      $push: {
        addresses: newAddress,
      },
    },
    { new: true }
  );

  return updatedUser;
};

module.exports = {
  setUserInfoService,
};
