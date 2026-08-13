const Reward = require("../../models/Reward");
const { REWARD_POPULATE } = require("./rewardValidation");

const getRewardsService = async (req, res) => {
  try {
    let response = await Reward.find().populate(REWARD_POPULATE);
    response = response.reverse();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getRewardsService,
};
