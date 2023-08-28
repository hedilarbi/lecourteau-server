const Setting = require("../models/Setting");

const getSetting = async (req, res) => {
  try {
    const response = await Setting.find();
    res.json(response);
  } catch (err) {
    res.json({ error: err.message });
  }
};

const updateSettings = async (req, res) => {
  const { id } = req.params;
  const { settings } = req.body;
  try {
    const response = await Setting.findByIdAndUpdate(
      id,
      { ...settings },
      { new: true }
    );
    res.json(response);
  } catch (err) {
    res.json({ message: err.message });
  }
};

module.exports = { getSetting, updateSettings };
