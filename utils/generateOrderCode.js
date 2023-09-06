const crypto = require("crypto");

function generateRandomCode(length) {
  const buffer = crypto.randomBytes(Math.ceil(length / 2));
  return buffer.toString("hex").slice(0, length);
}
module.exports = generateRandomCode;
