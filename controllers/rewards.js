const Reward = require("../models/Reward");

const {
  createRewardService,
} = require("../services/rewardServices/createRewardService");
const {
  deleteRewardsService,
} = require("../services/rewardServices/deleteRewardsService");

const createReward = async (req, res) => {
  const { item, points } = req.body;

  // Input validation
  if (!item || !points) {
    return res
      .status(400)
      .json({ success: false, error: "Item and points are required." });
  }

  if (isNaN(points) || points < 0) {
    return res
      .status(400)
      .json({ success: false, error: "Points must be a non-negative number." });
  }

  try {
    const { response, error } = await createRewardService(item, points);
    if (error) {
      return res.status(500).json({ success: false, error });
    }
    res.status(201).json(response);
  } catch (err) {
    console.error("Error creating reward:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

const getRewards = async (req, res) => {
  try {
    // Fetch rewards from the database, populating the item field
    let response = await Reward.find().populate({
      path: "item",
      select: "name image slug",
    });

    // Reverse the array if needed (assumed to get the latest rewards first)
    response = response.reverse();

    // Return a consistent response structure
    res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching rewards:", err); // Log the error for debugging
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

const deleteReward = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await deleteRewardsService(id);

    // Check if the service function indicates a successful deletion
    if (result.error) {
      return res.status(404).json({ success: false, message: result.error });
    }

    res
      .status(200)
      .json({ success: true, message: "Reward deleted successfully" });
  } catch (err) {
    console.error("Error deleting reward:", err); // Log the error for debugging
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { createReward, getRewards, deleteReward };
