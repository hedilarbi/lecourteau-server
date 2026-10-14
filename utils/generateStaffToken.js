const jwt = require("jsonwebtoken");
require("dotenv/config");
const getStaffSecretKey = require("./staffSecretKey");

const generateStaffToken = (id, username) => {
  return jwt.sign(
    {
      id,
      username,
    },
    getStaffSecretKey()
  );
};

module.exports = generateStaffToken;
