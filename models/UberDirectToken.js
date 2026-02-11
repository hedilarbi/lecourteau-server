const { Schema, model } = require("mongoose");

const uberDirectTokenSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    access_token: { type: String, required: true },
    token_type: { type: String, default: "Bearer" },
    scope: { type: String },
    expires_in: { type: Number, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

uberDirectTokenSchema.index({ expires_at: 1 });

module.exports = model("UberDirectToken", uberDirectTokenSchema);
