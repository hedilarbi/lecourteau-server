const Setting = require("../../models/Setting");

const updateSettingsService = async (id, settings) => {
  try {
    const response = await Setting.findByIdAndUpdate(
      id,
      { ...settings },
      { new: true }
    );

    if (!response) {
      return { error: "Settings not found" }; // Handle case where no settings were found
    }

    return { response };
  } catch (error) {
    console.error("Error in updateSettingsService:", error); // Log the error
    return { error: error.message };
  }
};

module.exports = {
  updateSettingsService,
};
