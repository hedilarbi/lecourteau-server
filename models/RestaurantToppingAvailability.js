const { Schema, model } = require("mongoose");

const restaurantToppingAvailabilitySchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    topping: {
      type: Schema.Types.ObjectId,
      ref: "Topping",
      required: true,
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

restaurantToppingAvailabilitySchema.index(
  { restaurant: 1, topping: 1 },
  { unique: true },
);

module.exports = model(
  "RestaurantToppingAvailability",
  restaurantToppingAvailabilitySchema,
);
