const User = require("../../models/User");
const mongoose = require("mongoose");

const deleteFromAddressesService = async (id, addressId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { error: "Invalid user id", status: 400 };
    }
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return { error: "Invalid address id", status: 400 };
    }

    const user = await User.findOneAndUpdate(
      { _id: id, "addresses._id": addressId },
      { $pull: { addresses: { _id: addressId } } },
      { new: true, runValidators: true },
    );
    if (!user) return { error: "User or address not found", status: 404 };

    return { user };
  } catch (err) {
    return { error: err.message, status: 500 };
  }
};

module.exports = {
  deleteFromAddressesService,
};
