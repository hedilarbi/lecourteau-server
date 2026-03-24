const { Schema, model } = require("mongoose");

const restaurantOfferAvailabilitySchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    offer: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },
    // Exception-only model:
    // - no document means the offer is available for the restaurant
    // - a document means the offer is unavailable for the restaurant
    isAvailable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

restaurantOfferAvailabilitySchema.index(
  { restaurant: 1, offer: 1 },
  { unique: true },
);

module.exports = model(
  "RestaurantOfferAvailability",
  restaurantOfferAvailabilitySchema,
);
