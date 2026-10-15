const { Schema, model } = require("mongoose");

const restaurantSchema = new Schema({
  name: String,
  address: String,
  location: {
    longitude: Number,
    latitude: Number,
  },
  phone_number: String,
  uberCustomerId: String,
  orders: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  menu_items: [
    {
      menuItem: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
      availability: {
        type: Boolean,
        default: true,
      },
    },
  ],
  toppings: [
    {
      topping: {
        type: Schema.Types.ObjectId,
        ref: "Topping",
      },
      availability: {
        type: Boolean,
        default: true,
      },
    },
  ],
  offers: [
    {
      offer: {
        type: Schema.Types.ObjectId,
        ref: "Offer",
      },
      availability: {
        type: Boolean,
        default: true,
      },
    },
  ],
  staff: [
    {
      employee: {
        type: Schema.Types.ObjectId,
        ref: "Staff",
      },
    },
  ],
  expo_token: String,
  settings: {
    working_hours: {
      open: {
        hours: String,
        minutes: String,
      },
      close: {
        hours: String,
        minutes: String,
      },
    },
    emploie_du_temps: {
      lundi: {
        open: { type: String }, // E.g., "08:00"
        close: { type: String }, // E.g., "12:00"
      },

      mardi: {
        open: { type: String },
        close: { type: String },
      },

      mercredi: {
        open: { type: String },
        close: { type: String },
      },

      jeudi: {
        open: { type: String },
        close: { type: String },
      },

      vendredi: {
        open: { type: String },
        close: { type: String },
      },
      samedi: {
        open: { type: String },
        close: { type: String },
      },

      dimanche: {
        open: { type: String },
        close: { type: String },
      },
    },
    delivery: Boolean,
    open: Boolean,
    delivery_fee: Number,
    delivery_range: Number,
    // Pourboire du livreur Uber Direct (voir utils/uberCourierTip.js).
    uber_courier_tip: {
      // Pourboire du client de 1 $ ou plus : montant fixe ou % du pourboire du client.
      with_customer_tip: {
        mode: { type: String, enum: ["fixed", "percent"], default: "fixed" },
        value: { type: Number, default: 0 },
      },
      // Pourboire du client sous 1 $ : montant fixe.
      without_customer_tip_amount: { type: Number, default: 0 },
      // Commande sous ce montant (sous-total après rabais) : aucun pourboire. 0 = pas de seuil.
      min_order_amount: { type: Number, default: 0 },
    },
  },
});

module.exports = model("Restaurant", restaurantSchema);
