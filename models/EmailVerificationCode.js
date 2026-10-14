const { Schema, model } = require("mongoose");

// Un seul code actif par utilisateur : chaque envoi remplace le précédent.
// Le document est purgé automatiquement 24 h après le dernier envoi, ce qui
// conserve le compteur d'envois assez longtemps pour limiter les abus.
const emailVerificationCodeSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  codeHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  lastSentAt: {
    type: Date,
    required: true,
    expires: 60 * 60 * 24,
  },
  sendCount: {
    type: Number,
    default: 0,
  },
  sendWindowStartedAt: {
    type: Date,
    required: true,
  },
});

module.exports = model("EmailVerificationCode", emailVerificationCodeSchema);
