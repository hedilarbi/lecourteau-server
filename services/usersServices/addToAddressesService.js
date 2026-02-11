const User = require("../../models/User");

const addToAddressesService = async (
  id,
  address,
  coords,
  street_address,
  city,
  state,
  postal_code,
  country,
) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      return { error: "User not found" };
    }
    user.addresses.push({
      address,
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
      street_address,
      city,
      state,
      postal_code,
      country,
    });
    await user.save();
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  addToAddressesService,
};
