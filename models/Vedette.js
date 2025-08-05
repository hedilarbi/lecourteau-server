const { Schema, model, Types } = require("mongoose");

const VedetteSchema = new Schema(
  {
    menuItem: {
      type: Types.ObjectId,
      ref: "MenuItem",
    },
    order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true, // ajoute createdAt et updatedAt
  }
);

module.exports = model("Vedette", VedetteSchema);
