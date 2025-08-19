const { Schema, model } = require("mongoose");

const categorySchema = new Schema({
  name: String,
  slug: String,
  image: String,
  order: Number,
});

module.exports = model("Category", categorySchema);
