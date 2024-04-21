const Setting = require("../../models/Setting");
const mongoose = require("mongoose");
const getSettingsService = async () => {
  try {
    const settings = await Setting.find();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "name address location"
    );
    return { settings, restaurants };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getSettingsService,
};
