const { default: mongoose } = require("mongoose");
const Setting = require("../models/Setting");

const getSetting = async (req, res) => {
  try {
    const settings = await Setting.find();
    const restaurants = await mongoose.models.Restaurant.find().select(
      "name address location"
    );

    res.status(200).json({ settings, restaurants });
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
