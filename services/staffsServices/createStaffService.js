const Staff = require("../../models/staff");
const saltRounds = 10;
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const createStaffService = async (
  name,
  username,
  password,
  role,
  restaurant,
  firebaseUrl
) => {
  try {
    const verifyStaff = await Staff.findOne({ username });

    if (verifyStaff) {
      return { error: "staff already exists" };
    }

    const hashedPasword = await bcrypt.hash(password, saltRounds);
    if (firebaseUrl) {
      const newStaff = new Staff({
        name,
        restaurant,
        username,
        password: hashedPasword,
        role,
        image: firebaseUrl,
        createdAt: new Date().toISOString(),
      });

      const response = await newStaff.save();

      const restau = await mongoose.models.Restaurant.findById(restaurant);
      restau.staff.push(response._id);
      await restau.save();
      return { response };
    } else {
      const newStaff = new Staff({
        name,
        restaurant,
        username,
        password: hashedPasword,
        role,
        createdAt: new Date().toISOString(),
      });

      const response = await newStaff.save();

      const restau = await mongoose.models.Restaurant.findById(restaurant);
      restau.staff.push(response._id);
      await restau.save();
      return { response };
    }
  } catch (err) {
    return { error: err.message };
  }
};
module.exports = {
  createStaffService,
};
