const jwt = require("jsonwebtoken");
const Staff = require("../../models/staff");
const getStaffByTokenService = async (token) => {
  try {
    const decodedData = jwt.verify(token, process.env.SECRET_KEY);

    const response = await Staff.findById(decodedData.id);
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getStaffByTokenService,
};
