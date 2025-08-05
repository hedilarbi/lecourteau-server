const Reward = require("../../models/Reward");
const createRewardService = async (item, points) => {
  try {
    const newReward = new Reward({
      item,
      points: parseInt(points),
    });

    // Save the new reward
    await newReward.save();
    // Populate the item after saving
    const populatedReward = await newReward.populate("item");
    return { response: populatedReward };
  } catch (err) {
    console.error("Error in createRewardService:", err);
    return { error: err.message || "Failed to create reward." };
  }
};

module.exports = {
  createRewardService,
};
