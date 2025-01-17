const { Schema, model } = require("mongoose");

const appSchema = new Schema({
  appVersion: String,
  iosAppVersion: String,
});

module.exports = model("App", appSchema);
