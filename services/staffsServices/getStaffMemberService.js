const Staff = require("../../models/staff");

const getStaffMemberService = async (id) => {
  try {
    const response = await Staff.findById(id).populate({
      path: "restaurant",
      select: "name",
    });
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getStaffMemberService,
};
