const Reward = require("../../models/Reward");

const createRewardService = async (item, points) => {
  try {
    const newReward = new Reward({
      item,
      points: parseInt(points),
    });

    const response = await newReward.save();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  createRewardService,
};
