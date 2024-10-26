const Staff = require("../../models/staff");
const generateStaffToken = require("../../utils/generateStaffToken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const loginStaffService = async (username, password, expoToken) => {
  try {
    const staff = await Staff.findOne({ username });
    if (!staff) {
      return { error: "staff not found" };
    }
    const verify = bcrypt.compare(password, staff.password);
    console.log(verify);
    if (!verify) {
      return { error: "wrong password" };
    }

    const token = generateStaffToken(staff._id, staff.username);
    if (staff.role === "Livreur") {
      await mongoose.models.Staff.findByIdAndUpdate(
        staff._id,
        { expo_token: expoToken },
        { new: true }
      );
    } else {
      await mongoose.models.Restaurant.findByIdAndUpdate(
        staff.restaurant,
        { expo_token: expoToken },
        { new: true }
      );
    }

    return { staff, token };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  loginStaffService,
};
