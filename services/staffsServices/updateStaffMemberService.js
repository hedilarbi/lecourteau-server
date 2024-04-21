const Staff = require("../../models/staff");

const updateStaffMemberService = async (
  id,
  name,
  username,
  restaurant,
  role
) => {
  try {
    const response = await Staff.findByIdAndUpdate(
      id,
      {
        name,
        username,
        role,
        restaurant,
      },
      { new: true }
    ).populate({ path: "restaurant", select: "name" });

    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateStaffMemberService,
};
