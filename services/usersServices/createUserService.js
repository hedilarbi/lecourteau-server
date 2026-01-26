const User = require("../../models/User");
const generateToken = require("../../utils/generateToken");

const createUserService = async (phone_number) => {
  try {
    const verifyPhone = await User.findOne({ phone_number });

    if (verifyPhone) {
      const token = generateToken(verifyPhone._id, verifyPhone.phone_number);
      return { user: verifyPhone, token };
    }
    const newUser = new User({
      phone_number,
      createdAt: new Date().toISOString(),
      is_profile_setup: false,
    });

    const response = await newUser.save();
    const token = generateToken(response._id, response.phone_number);

    return { user: response, token };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  createUserService,
};
