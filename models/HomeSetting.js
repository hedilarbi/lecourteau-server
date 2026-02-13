const { Schema, model } = require("mongoose");

const homeSettingSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subTitle: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      default: null,
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    codePromoId: {
      type: Schema.Types.ObjectId,
      ref: "PromoCode",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = model("HomeSetting", homeSettingSchema);
