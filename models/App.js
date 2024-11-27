const { Schema, model } = require("mongoose");

const appSchema = new Schema({
  appVersion: String,
});

module.exports = model("App", appSchema);
