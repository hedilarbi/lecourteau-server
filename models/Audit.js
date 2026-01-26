const { Schema, model } = require("mongoose");

const auditSchema = new Schema({
  detailsModel: {
    type: String,
    enum: ["Order", "Restaurant"], // add your models here
    required: false,
  },
  userId: { type: Schema.Types.ObjectId, ref: "Staff" },
  action: [String],
  timestamp: { type: Date, default: Date.now },
  details: {
    type: Schema.Types.ObjectId,
    refPath: "detailsModel",
    required: false,
  },
});

module.exports = model("Audit", auditSchema);
