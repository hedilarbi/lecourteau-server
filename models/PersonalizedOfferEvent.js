const { Schema, model } = require("mongoose");

const personalizedOfferEventSchema = new Schema({
  personalizedOffer: {
    type: Schema.Types.ObjectId,
    ref: "PersonalizedOffer",
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  eventType: {
    type: String,
    enum: ["created", "notified", "notif_clicked", "viewed", "clicked", "applied", "expired"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = model("PersonalizedOfferEvent", personalizedOfferEventSchema);
