const multer = require("multer");

const Multer = multer({
  storage: multer.memoryStorage(),
  limits: 10 * 1024 * 1024,
});

module.exports = Multer;
