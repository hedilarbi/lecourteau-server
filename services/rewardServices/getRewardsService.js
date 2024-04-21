const Reward = require("../../models/Reward");

const getRewardsService = async (req, res) => {
  try {
    let response = await Reward.find().populate({
      path: "item",
      select: "name",
    });
    response = response.reverse();
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  getRewardsService,
};
