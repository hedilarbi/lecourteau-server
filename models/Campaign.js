const { Schema, model } = require("mongoose");

const campaignSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  priority: {
    type: Number,
    default: 0, // Higher number = higher priority
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

campaignSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = model("Campaign", campaignSchema);
