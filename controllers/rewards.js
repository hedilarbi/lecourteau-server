const Reward = require("../models/Reward");

const createReward = async (req, res) => {
  const { item, points } = req.body;
  try {
    const newReward = new Reward({
      item,
      points: parseFloat(points),
    });
    const response = await newReward.save();
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getRewards = async (req, res) => {
  try {
    let response = await Reward.find().populate({
      path: "item",
      select: "name",
    });
    response = response.reverse();
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteReward = async (req, res) => {
  const { id } = req.params;
  try {
    await Reward.findByIdAndDelete(id);
    res.status(200).json({ success: false, message: "reward deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createReward, getRewards, deleteReward };
