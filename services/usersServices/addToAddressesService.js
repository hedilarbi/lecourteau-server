const User = require("../../models/User");

const addToAddressesService = async (id, address, coords) => {
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
