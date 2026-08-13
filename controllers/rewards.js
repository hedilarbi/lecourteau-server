const Reward = require("../models/Reward");

const {
  createRewardService,
} = require("../services/rewardServices/createRewardService");
const {
  updateRewardService,
} = require("../services/rewardServices/updateRewardService");
const {
  deleteRewardsService,
} = require("../services/rewardServices/deleteRewardsService");
const { REWARD_POPULATE } = require("../services/rewardServices/rewardValidation");

// Validation commune à la création et à la modification.
const validatePayload = ({ item, size, points }) => {
  if (!item || !points) {
    return "Item and points are required.";
  }

  if (typeof size !== "string" || size.trim().length === 0) {
    return "Size is required.";
  }

  if (isNaN(points) || points < 0) {
    return "Points must be a non-negative number.";
  }

  return null;
};

const createReward = async (req, res) => {
  const { item, points } = req.body;
  const size = typeof req.body.size === "string" ? req.body.size.trim() : "";

  // Input validation
  const validationError = validatePayload({ item, size, points });
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  try {
    const { response, error, statusCode } = await createRewardService(
      item,
      size,
      points
    );
    if (error) {
      return res.status(statusCode || 500).json({ success: false, error });
    }
    res.status(201).json(response);
  } catch (err) {
    console.error("Error creating reward:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

const updateReward = async (req, res) => {
  const { id } = req.params;
  const { item, points } = req.body;
  const size = typeof req.body.size === "string" ? req.body.size.trim() : "";

  const validationError = validatePayload({ item, size, points });
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  try {
    const { response, error, statusCode } = await updateRewardService(
      id,
      item,
      size,
      points
    );
    if (error) {
      return res.status(statusCode || 500).json({ success: false, error });
    }
    res.status(200).json(response);
  } catch (err) {
    console.error("Error updating reward:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

const getRewards = async (req, res) => {
  try {
    // Fetch rewards from the database, populating the item field
    let response = await Reward.find().populate(REWARD_POPULATE);

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

module.exports = { createReward, getRewards, updateReward, deleteReward };
