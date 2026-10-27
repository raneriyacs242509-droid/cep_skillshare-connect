
const mongoose = require("mongoose");

const interestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        skill: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["Pending", "Accepted", "Rejected", "Completed"],
            default: "Pending"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Interest", interestSchema);
