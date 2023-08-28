const jwt = require("jsonwebtoken");
require("dotenv/config");

const generateStaffToken = (id, username) => {
  return jwt.sign(
    {
      id,
      username,
    },
    process.env.SECRET_KEY
  );
};

module.exports = generateStaffToken;
