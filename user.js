
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        age: {
            type: String,
            default: ""
        },

        role: {
            type: String,
            enum: [
                "Student",
                "Working Professional",
                "Self-employed",
                "Homemaker",
                "Community Volunteer",
                "Retired",
                "Other"
            ],
            default: "Other"
        },

        skills: {
            type: [String],
            default: []
        },

        bio: {
            type: String,
            default: ""
        },

        accountType: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);