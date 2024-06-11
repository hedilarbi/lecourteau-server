const Reward = require("../models/Reward");

const {
  createRewardService,
} = require("../services/rewardServices/createRewardService");
const {
  deleteRewardsService,
} = require("../services/rewardServices/deleteRewardsService");

const createReward = async (req, res) => {
  const { item, points } = req.body;

  try {
    const { response } = await createRewardService(item, points);
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
    await deleteRewardsService(id);
    res.status(200).json({ success: true, message: "reward deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createReward, getRewards, deleteReward };
