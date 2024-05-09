const { Schema, model } = require("mongoose");

const LocalOrderSchema = new Schema(
  {
    table: Number,
    items: [
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
        size: String,
        price: Number,
      },
    ],
    total_price: Number,
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    state: String,
  },
  { timestamps: true }
);

module.exports = model("LocalOrder", LocalOrderSchema);
