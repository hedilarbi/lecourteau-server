const { Schema, model } = require("mongoose");

const smartClientLogSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      maxlength: 120,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: "SmartClientRule",
      default: null,
      index: true,
    },
    exposureId: {
      type: Schema.Types.ObjectId,
      ref: "SmartClientExposure",
      default: null,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      enum: [
        "state_changed",
        "cart_changed",
        "screen_view",
        "screen_entered",
        "screen_duration",
        "screen_idle",
        "app_resumed",
        "app_backgrounded",
        "tappable_clicked",
        "smart_offer_triggered",
        "smart_offer_accepted",
        "smart_offer_refused",
        "search_no_results",
        "promo_code_failed",
        "promo_viewed",
        "option_changed",
        "size_changed",
        "cart_total_viewed",
        "cart_exit_intent",
        "checkout_started",
        "checkout_returned_to_cart",
        "order_confirmed",
        "user_interaction",
        "context_changed",
        "app_opened",
        "app_heartbeat",
        "app_closed",
        "app_terminated",
        "smart_offer_converted",
        "smart_offer_ignored",
        "personalized_offer_ignored",
        "user_session_ended",
      ],
    },
    state: {
      type: String,
    },
    signals: {
      type: Schema.Types.Mixed,
      default: {},
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    receivedAt: { type: Date, default: Date.now },
    schemaVersion: { type: Number, default: 2 },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

smartClientLogSchema.index({ timestamp: -1, event: 1 });
smartClientLogSchema.index({ sessionId: 1, timestamp: 1 });
smartClientLogSchema.index({ ruleId: 1, timestamp: -1 });
smartClientLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model("SmartClientLog", smartClientLogSchema);
