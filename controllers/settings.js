const Setting = require("../models/Setting");
const {
  getSettingsService,
} = require("../services/settingsServices/getSettingsService");
const {
  updateSettingsService,
} = require("../services/settingsServices/updateSettingsService");

const getSetting = async (req, res) => {
  try {
    const { settings, restaurants } = await getSettingsService();

    res.status(200).json({ settings, restaurants });
  } catch (err) {
    res.json({ error: err.message });
  }
};

const updateSettings = async (req, res) => {
  const { id } = req.params;
  const { settings } = req.body;
  console.log(settings);
  try {
    const { response, error } = await updateSettingsService(id, settings);
    if (error) {
      return res.status(400).json({ message: error });
    }
    res.json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

module.exports = { getSetting, updateSettings };
