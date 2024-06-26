const User = require("../../models/User");

const deleteFromAddressesService = async (id, addressId) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      return { error: "User not found" };
    }
    const addressIndex = user.addresses.findIndex(
      (address) => address._id.toString() === addressId
    );
    if (addressIndex === -1) {
      return { error: "Address not found" };
    }
    user.addresses.splice(addressIndex, 1);
    await user.save();
    return { user };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  deleteFromAddressesService,
};
