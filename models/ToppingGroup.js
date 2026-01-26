const { Schema, model } = require("mongoose");

const selectionRuleSchema = new Schema(
  {
    // selection required or optional; max can be null (unlimited)
    isRequired: { type: Boolean, default: false },
    min: { type: Number, default: 0 },
    max: { type: Number, default: null },
  },
  { _id: false }
);

const toppingGroupSchema = new Schema({
  name: String,
  toppings: [{ type: Schema.Types.ObjectId, ref: "Topping" }],
  selectionRule: { type: selectionRuleSchema, default: () => ({}) },
});

module.exports = model("ToppingGroup", toppingGroupSchema);
