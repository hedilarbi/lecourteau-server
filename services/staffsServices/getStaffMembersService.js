const Staff = require("../../models/staff");
const getStaffMembersService = async (req, res) => {
  try {
    const response = await Staff.find().populate({
      path: "restaurant",
      select: "name",
    });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getStaffMembersService,
};
