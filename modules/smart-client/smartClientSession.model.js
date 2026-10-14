const { Schema, model } = require("mongoose");

const schema = new Schema({
  sessionId: { type: String, required: true, unique: true, maxlength: 100 },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  channel: { type: String, enum: ["app", "web"], default: "app" },
  status: { type: String, enum: ["active", "background", "closed", "expired"], default: "active", index: true },
  startedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  appVersion: { type: String, default: "", maxlength: 50 },
  deviceIdHash: { type: String, default: "", maxlength: 128 },
}, { timestamps: true, strict: "throw" });

schema.index({ user: 1, startedAt: -1 });
module.exports = model("SmartClientSession", schema);
