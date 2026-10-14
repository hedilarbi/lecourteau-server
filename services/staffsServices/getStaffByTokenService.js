const jwt = require("jsonwebtoken");
const Staff = require("../../models/staff");
const getStaffSecretKey = require("../../utils/staffSecretKey");
const getStaffByTokenService = async (token) => {
  try {
    const decodedData = jwt.verify(token, getStaffSecretKey());
    const rawStaffId =
      decodedData?.id ||
      decodedData?._id ||
      decodedData?.staffId ||
      decodedData?.userId ||
      null;
    const normalizedStaffId =
      rawStaffId && typeof rawStaffId === "object"
        ? rawStaffId?.id || rawStaffId?._id || rawStaffId?.toString?.()
        : rawStaffId;

    if (!normalizedStaffId) {
      return { error: "Staff ID missing in token." };
    }

    const response = await Staff.findById(normalizedStaffId);

    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getStaffByTokenService,
};
