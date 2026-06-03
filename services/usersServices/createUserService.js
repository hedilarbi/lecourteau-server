const User = require("../../models/User");
const generateToken = require("../../utils/generateToken");
const generateRandomCode = require("../../utils/generateOrderCode");

const normalizePhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("11") && digits.length === 12) return "+" + digits.slice(1);
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
};

const createUserService = async (phone_number) => {
  try {
    const normalized = normalizePhone(phone_number);
    const verifyPhone = await User.findOne({ phone_number: normalized });

    if (verifyPhone) {
      const token = generateToken(verifyPhone._id, verifyPhone.phone_number);
      return { user: verifyPhone, token };
    }

    let referralCode;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      referralCode = generateRandomCode(6).toUpperCase();
      const existing = await User.findOne({ referralCode });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    const newUser = new User({
      phone_number: normalized,
      createdAt: new Date().toISOString(),
      is_profile_setup: false,
      referralCode,
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
