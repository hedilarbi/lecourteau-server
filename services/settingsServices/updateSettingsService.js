const Setting = require("../../models/Setting");

const updateSettingsService = async (id, settings) => {
  try {
    const response = await Setting.findByIdAndUpdate(
      id,
      { ...settings },
      { new: true }
    );
    return { response };
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  updateSettingsService,
};
