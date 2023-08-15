const jwt = require("jsonwebtoken");
require("dotenv/config");

const generateToken = (id, phone_number) => {
  return jwt.sign(
    {
      id,
      phone_number,
    },
    process.env.SECRET_KEY
  );
};

module.exports = generateToken;
