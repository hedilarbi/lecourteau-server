const { Schema, model } = require("mongoose");

const rewardSchema = new Schema({
  item: {
    type: Schema.Types.ObjectId,
    ref: "MenuItem",
  },
  size: String,
  points: Number,
});

// Un même article peut être proposé en récompense plusieurs fois,
// mais jamais deux fois avec la même taille.
// Le filtre partiel laisse de côté les anciennes récompenses sans taille.
rewardSchema.index(
  { item: 1, size: 1 },
  {
    unique: true,
    partialFilterExpression: { size: { $type: "string" } },
  }
);

module.exports = model("Reward", rewardSchema);
