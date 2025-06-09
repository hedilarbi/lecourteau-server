const {
  getSettingsService,
} = require("../services/settingsServices/getSettingsService");
const {
  updateSettingsService,
} = require("../services/settingsServices/updateSettingsService");
const getSetting = async (req, res) => {
  try {
    const { settings, restaurants, error } = await getSettingsService();

    // Check if there was an error in the service function
    if (error) {
      return res.status(500).json({ success: false, message: error });
    }

    res.status(200).json({ settings, restaurants });
  } catch (err) {
    console.error("Error fetching settings:", err); // Log the error for debugging
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const updateSettings = async (req, res) => {
  const { id } = req.params;
  const { settings } = req.body;

  try {
    const { response, error } = await updateSettingsService(id, settings);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    const timeStamp = new Date().toISOString();
    console.log(`${timeStamp} - Settings updated successfully for ID: ${id}`); // Log the success message with timestamp
    res.status(200).json(response);
  } catch (err) {
    console.error("Error updating settings:", err); // Log the error
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { getSetting, updateSettings };
