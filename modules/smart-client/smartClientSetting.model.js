const { Schema, model } = require("mongoose");

const schema = new Schema({
  isActive: { type: Boolean, default: false },
  updatedBy: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
}, { timestamps: true, strict: "throw" });

module.exports = model("SmartClientSetting", schema);
