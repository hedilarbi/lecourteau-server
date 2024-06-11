const Reward = require("../../models/Reward");

const createRewardService = async (item, points) => {
  try {
    const newReward = new Reward({
      item,
      points: parseInt(points),
    });

    await newReward.save();
    const response = await newReward.populate("item");
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  createRewardService,
};
