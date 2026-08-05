const Reward = require("../../models/Reward");
const {
  REWARD_POPULATE,
  DUPLICATE_MESSAGE,
  validateItemAndSize,
} = require("./rewardValidation");

const updateRewardService = async (id, item, size, points) => {
  try {
    const reward = await Reward.findById(id);
    if (!reward) {
      return { error: "Récompense introuvable.", statusCode: 404 };
    }

    const { error, statusCode } = await validateItemAndSize(item, size, id);
    if (error) {
      return { error, statusCode };
    }

    reward.item = item;
    reward.size = size;
    reward.points = parseInt(points);

    await reward.save();
    const populatedReward = await reward.populate(REWARD_POPULATE);
    return { response: populatedReward };
  } catch (err) {
    console.error("Error in updateRewardService:", err);
    if (err.code === 11000) {
      return { error: DUPLICATE_MESSAGE, statusCode: 409 };
    }
    return { error: err.message || "Failed to update reward." };
  }
};

module.exports = {
  updateRewardService,
};
