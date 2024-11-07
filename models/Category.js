const { Schema, model } = require("mongoose");

const categorySchema = new Schema({
  name: String,
  image: String,
  order: Number,
});

module.exports = model("Category", categorySchema);
