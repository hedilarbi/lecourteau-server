const { Schema, model } = require("mongoose");

const newSchema = new Schema({
  name: String,
  image: String,
});

module.exports = model("New", newSchema);
