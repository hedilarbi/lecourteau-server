const App = require("../models/App");

const createApp = async (req, res) => {
  try {
    const app = new App({
      appVersion: req.body.appVersion,
    });
    await app.save();
    res.status(201).json(app);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getApp = async (req, res) => {
  try {
    let response = await App.find();
    response = response[0];
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateApp = async (req, res) => {
  try {
    const { appVersion, iosAppVersion } = req.body;
    const response = await App.findByIdAndUpdate(
      req.params.id,
      { appVersion, iosAppVersion },
      {
        new: true,
      }
    );
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { createApp, getApp, updateApp };
