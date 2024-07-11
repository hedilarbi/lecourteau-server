const { Schema, model } = require("mongoose");

const categorySchema = new Schema({
  name: String,
  image: String,
  customization: [
    {
      type: Schema.Types.ObjectId,
      ref: "Topping",
    },
  ],
});

module.exports = model("Category", categorySchema);
