const { Schema, model } = require("mongoose");

const offerSchema = new Schema({
  name: String,
  image: String,
  slug: String,
  order: {
    type: Number,
    default: 1,
  },
  items: [
    {
      item: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      quantity: Number,
      size: String,
    },
  ],
  price: Number,
  // Nombre d'articles que le client choisit parmi `items` (prix de l'offre inchangé).
  // null = tous les articles sont inclus (fonctionnement historique).
  // Un article avec quantity > 1 (ex. Frites ×2) compte pour UN choix.
  itemsToChoose: {
    type: Number,
    default: null,
  },
  createdAt: Date,
  expireAt: Date,
});

module.exports = model("Offer", offerSchema);
