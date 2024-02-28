const { Schema, model } = require("mongoose");

const staffSchema = new Schema({
  username: String,
  name: String,
  password: String,
  createdAt: Date,
  role: String,
  image: String,
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
  },
});

module.exports = model("Staff", staffSchema);
