const { deleteImagesFromFirebase } = require("../../firebase");
const Staff = require("../../models/staff");
const deleteStaffMemberService = async (id) => {
  try {
    const response = await Staff.findById(id);
    if (!response) {
      return { error: "Staff member not found" };
    }
    await deleteImagesFromFirebase(response.image);
    await Staff.findByIdAndDelete(id);
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  deleteStaffMemberService,
};
