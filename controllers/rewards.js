const Reward = require("../models/Reward");

const createReward = async (req, res) => {
  const { item, points } = req.body;
  try {
    const newReward = new Reward({
      item,
      points,
    });
    const response = await newReward.save();
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getRewards = async (req, res) => {
  try {
    const response = await Reward.find().populate("item");
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { createReward, getRewards };
