const { Schema, model } = require("mongoose");

const sizesGroupSchema = new Schema({
  name: String,
  sizes: [{ type: Schema.Types.ObjectId, ref: "Size" }],
});

module.exports = model("SizesGroup", sizesGroupSchema);
