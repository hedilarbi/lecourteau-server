const { Schema, model } = require("mongoose");

const rewardSchema = new Schema({
  item: {
    type: Schema.Types.ObjectId,
    ref: "MenuItem",
  },
  points: Number,
});

module.exports = model("Reward", rewardSchema);
