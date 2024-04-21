const Reward = require("../../models/Reward");

const deleteRewardsService = async (id) => {
  try {
    const response = await Reward.findByIdAndDelete(id);
    return { response };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  deleteRewardsService,
};
