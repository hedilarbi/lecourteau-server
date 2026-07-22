const { Schema, model } = require("mongoose");

/**
 * SystemStat — Clé-valeur pour les statistiques système calculées périodiquement.
 * Exemples : topCategory (catégorie la plus vendue), etc.
 */
const systemStatSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

module.exports = model("SystemStat", systemStatSchema);
