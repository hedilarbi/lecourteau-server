const { Schema, model } = require("mongoose");

const staffSchema = new Schema({
  username: String,
  name: String,
  password: String,
  createdAt: Date,
  role: String,
});

module.exports = model("Staff", staffSchema);
