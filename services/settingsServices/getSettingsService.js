const Setting = require("../../models/Setting");
const mongoose = require("mongoose");
const getSettingsService = async () => {
  try {
    const settings = await Setting.find();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "name address location"
    );
    return { settings, restaurants }; // No error here, so just return the data
  } catch (err) {
    console.error("Error in getSettingsService:", err); // Log the error for debugging
    return { error: err.message }; // Return the error message for further handling
  }
};

module.exports = {
  getSettingsService,
};
