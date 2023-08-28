const { Schema, model } = require("mongoose");

const settingSchema = new Schema({
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
  delivery: Boolean,
  open: Boolean,
  delivery_fee: Number,
  addresses: [
    {
      province: String,
      postal_code: String,
      city: String,
      street: String,
    },
  ],
});

module.exports = model("Setting", settingSchema);
