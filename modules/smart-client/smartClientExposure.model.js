const { Schema, model } = require("mongoose");

const schema = new Schema({
  rule: { type: Schema.Types.ObjectId, ref: "SmartClientRule", required: true, index: true },
  ruleVersion: { type: Number, required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: String, required: true, index: true, maxlength: 100 },
  assignmentKey: { type: String, required: true, maxlength: 100 },
  group: { type: String, enum: ["exposed", "control"], required: true },
  variant: { type: String, default: "default", maxlength: 80 },
  status: { type: String, enum: ["assigned", "displayed", "accepted", "refused", "converted", "ignored", "expired", "cancelled"], default: "assigned", index: true },
  displayedAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  refusedAt: { type: Date, default: null },
  convertedAt: { type: Date, default: null },
  ignoredAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
  order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  discountCost: { type: Number, min: 0, default: 0 },
  revenue: { type: Number, min: 0, default: 0 },
  context: {
    state: { type: String, default: "" },
    event: { type: String, default: "" },
    location: { type: String, default: "" },
  },
}, { timestamps: true, strict: "throw" });

schema.index({ rule: 1, user: 1, createdAt: -1 });
schema.index({ rule: 1, sessionId: 1, createdAt: -1 });
module.exports = model("SmartClientExposure", schema);
