
const mongoose = require("mongoose");

const skillRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    skill: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Declined", "Completed"],
      default: "Pending"
    }
  },
  { timestamps: true }
);

skillRequestSchema.index({ sender: 1, receiver: 1, skill: 1 });

module.exports = mongoose.model("SkillRequest", skillRequestSchema);
