const { Schema, model } = require("mongoose");

const offerSchema = new Schema({
  name: String,
  image: String,
});

module.exports = model("Offer", offerSchema);
