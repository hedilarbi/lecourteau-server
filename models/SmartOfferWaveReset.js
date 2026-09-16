const { Schema, model } = require("mongoose");

const smartOfferWaveResetSchema = new Schema({
  createdAt: { type: Date, required: true, default: Date.now },
  expiredOffersCount: { type: Number, required: true },
}, { collection: "smartofferwaveresets" });

module.exports = model("SmartOfferWaveReset", smartOfferWaveResetSchema);
