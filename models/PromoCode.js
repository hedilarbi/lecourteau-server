const { Schema, model, Types } = require("mongoose");

const PromoCodeSchema = new Schema(
  {
    code: {
      type: String,

      unique: true,
      uppercase: true, // FORCE le code en majuscules
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["amount", "percent", "free_item"],
    },
    // pour type === 'amount'
    amount: {
      type: Number, // ex: 5 => $5 OFF
      min: 0,
    },
    // pour type === 'percent'
    percent: {
      type: Number, // ex: 10 => 10% OFF
      min: 0,
      max: 100,
    },

    // pour type === 'free_item'
    freeItem: {
      type: Types.ObjectId,
      ref: "MenuItem", // référence à l'item gratuit
    },
    startDate: {
      type: Date,
      default: Date.now, // date de début de validité
    },
    endDate: Date, // date d’expiration

    usagePerUser: {
      type: Number, // nombre de fois par user
      default: 1,
    },
    totalUsage: {
      type: Number, // nombre total d'utilisations
      default: 0,
    },
  },
  {
    timestamps: true, // ajoute createdAt et updatedAt
  }
);

module.exports = model("PromoCode", PromoCodeSchema);
