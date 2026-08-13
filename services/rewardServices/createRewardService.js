const Reward = require("../../models/Reward");
const {
  REWARD_POPULATE,
  DUPLICATE_MESSAGE,
  validateItemAndSize,
} = require("./rewardValidation");

const createRewardService = async (item, size, points) => {
  try {
    const { error, statusCode } = await validateItemAndSize(item, size);
    if (error) {
      return { error, statusCode };
    }

    const newReward = new Reward({
      item,
      size,
      points: parseInt(points),
    });

    // Save the new reward
    await newReward.save();
    // Populate the item after saving
    const populatedReward = await newReward.populate(REWARD_POPULATE);
    return { response: populatedReward };
  } catch (err) {
    console.error("Error in createRewardService:", err);
    if (err.code === 11000) {
      return { error: DUPLICATE_MESSAGE, statusCode: 409 };
    }
    return { error: err.message || "Failed to create reward." };
  }
};

module.exports = {
  createRewardService,
};
