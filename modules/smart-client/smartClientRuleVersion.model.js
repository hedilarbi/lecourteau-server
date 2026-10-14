const { Schema, model } = require("mongoose");

const schema = new Schema({
  rule: { type: Schema.Types.ObjectId, ref: "SmartClientRule", required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  action: { type: String, enum: ["created", "updated", "published", "status_changed", "archived"], required: true },
  actor: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
  snapshotJson: { type: String, required: true },
}, { timestamps: true, strict: "throw" });

schema.index({ rule: 1, version: 1 }, { unique: true });
module.exports = model("SmartClientRuleVersion", schema);
