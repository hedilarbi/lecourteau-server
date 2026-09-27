const { Schema, model } = require("mongoose");

const smartClientLogSchema = new Schema(
  {
    userId: {
      type: String,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      enum: ["state_changed", "cart_changed", "screen_view", "app_resumed", "app_backgrounded", "tappable_clicked"],
    },
    state: {
      type: String,
    },
    signals: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("SmartClientLog", smartClientLogSchema);
