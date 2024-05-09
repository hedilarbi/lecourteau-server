const { Schema, model } = require("mongoose");

const TableSchema = new Schema(
  {
    number: Number,
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
    },
    state: {
      type: String,
      default: "free",
    },
    basket: [
      {
        item: {
          type: Schema.Types.ObjectId,
          ref: "MenuItem",
        },
        customizations: [
          {
            type: Schema.Types.ObjectId,
            ref: "Topping",
          },
        ],
        uid: String,
        size: String,
        price: Number,
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

module.exports = model("Table", TableSchema);
