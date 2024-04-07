const User = require("../../models/User");

const addToAddressesService = async (id, address, coords) => {
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
};

module.exports = {
  addToAddressesService,
};
