const { Schema, model } = require("mongoose");

const restaurantMenuItemAvailabilitySchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    menuItem: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
      index: true,
    },
    // Exception-only model:
    // - no document means the item is available for the restaurant
    // - a document means the item is unavailable for the restaurant
    isAvailable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

restaurantMenuItemAvailabilitySchema.index(
  { restaurant: 1, menuItem: 1 },
  { unique: true },
);

module.exports = model(
  "RestaurantMenuItemAvailability",
  restaurantMenuItemAvailabilitySchema,
);
