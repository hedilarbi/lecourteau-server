const { Schema, model } = require("mongoose");

const sizeSchema = new Schema({
  name: String,
});

module.exports = model("Size", sizeSchema);
