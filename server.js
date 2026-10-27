
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const User = require("./models/user");
const Interest = require("./models/interest");
const SkillRequest = require("./models/skillRequest");

// ==================== TEST ROUTE ====================

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "SkillShareConnect backend is working!"
    });
});

// ==================== REGISTER ====================

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password, age, role, skills } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }

        if (skills !== undefined && !Array.isArray(skills)) {
            return res.status(400).json({
                success: false,
                message: "Skills must be a list."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        const cleanSkills = [...new Set(
            (skills || [])
                .filter(skill => typeof skill === "string")
                .map(skill => skill.trim())
                .filter(Boolean)
        )];

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            age: age || "",
            role: role || "Other",
            skills: cleanSkills,
            accountType: "user",
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: "Registration successful!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                age: user.age,
                role: user.role,
                skills: user.skills,
                accountType: user.accountType
            }
        });
    } catch (error) {
        console.error("Registration error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to register. Please try again."
        });
    }
});

// ==================== LOGIN ====================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from .env");
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            success: true,
            message: "Login successful!",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                age: user.age,
                role: user.role,
                skills: user.skills,
                bio: user.bio,
                accountType: user.accountType,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to log in. Please try again."
        });
    }
});

// ==================== VERIFY LOGIN TOKEN ====================

async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Please log in again."
        });
    }

    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing.");
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.id || !mongoose.isValidObjectId(decoded.id)) {
            return res.status(401).json({
                success: false,
                message: "Invalid login session."
            });
        }

        const user = await User.findById(decoded.id)
            .select("_id accountType isActive");

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Your account is unavailable. Please log in again."
            });
        }

        // This is the authenticated user's ID used by all private routes.
        req.userId = user._id.toString();
        req.accountType = user.accountType;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or has expired. Please log in again."
        });
    }
}

// ==================== CURRENT USER ====================

app.get("/api/me", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                age: user.age,
                role: user.role,
                skills: user.skills,
                bio: user.bio,
                accountType: user.accountType,
                isActive: user.isActive
            }
        });
    } catch (error) {
        console.error("Current user error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load user information."
        });
    }
});

// ==================== FIND MEMBERS ====================
// Returns real MongoDB IDs and public profile details.
// A logged-in user cannot see their own profile in this list.

app.get("/api/people", verifyToken, async (req, res) => {
    try {
        const people = await User.find({
            _id: { $ne: req.userId },
            isActive: { $ne: false },
            accountType: { $ne: "admin" }
        })
            .select("_id name skills")
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            people: people.map(person => ({
                _id: person._id.toString(),
                name: person.name || "Member",
                skills: Array.isArray(person.skills)
                    ? person.skills
                        .filter(skill => typeof skill === "string")
                        .map(skill => skill.trim())
                        .filter(Boolean)
                    : []
            }))
        });
    } catch (error) {
        console.error("Find members error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load member profiles."
        });
    }
});


 // ==================== FIND MEMBERS ====================

app.get("/api/people", verifyToken, async (req, res) => {
    try {
        const people = await User.find({
            _id: { $ne: req.userId },
            isActive: { $ne: false },
            accountType: { $ne: "admin" }
        })
            .select("_id name skills")
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            people: people.map(person => ({
                _id: person._id.toString(),
                name: person.name || "Member",
                skills: Array.isArray(person.skills)
                    ? person.skills
                        .filter(skill => typeof skill === "string")
                        .map(skill => skill.trim())
                        .filter(Boolean)
                    : []
            }))
        });
    } catch (error) {
        console.error("Find members error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load member profiles."
        });
    }
});

// ==================== VERIFY ADMIN ====================

function verifyAdmin(req, res, next) {
    if (req.accountType !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Administrator access required."
        });
    }

    next();
}

// ==================== UPDATE PROFILE ====================

app.put("/api/profile", verifyToken, async (req, res) => {
    try {
        const { name, age, role, skills, bio } = req.body;

        const allowedRoles = [
            "Student",
            "Working Professional",
            "Self-employed",
            "Self-employed / Business Owner",
            "Homemaker",
            "Community Volunteer",
            "Retired",
            "Other"
        ];

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name is required."
            });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name is too long."
            });
        }

        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid role."
            });
        }

        if (skills !== undefined && !Array.isArray(skills)) {
            return res.status(400).json({
                success: false,
                message: "Skills must be a list."
            });
        }

        if (bio !== undefined && typeof bio !== "string") {
            return res.status(400).json({
                success: false,
                message: "Bio must be text."
            });
        }

        const cleanSkills = [...new Set(
            (skills || [])
                .filter(skill => typeof skill === "string")
                .map(skill => skill.trim())
                .filter(Boolean)
        )];

        const updatedUser = await User.findByIdAndUpdate(
            req.userId,
            {
                $set: {
                    name: name.trim(),
                    age: age || "",
                    role: role || "Other",
                    skills: cleanSkills,
                    bio: bio || ""
                }
            },
            {
                new: true,
                runValidators: true
            }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            message: "Profile saved successfully!",
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                age: updatedUser.age,
                role: updatedUser.role,
                skills: updatedUser.skills,
                bio: updatedUser.bio,
                accountType: updatedUser.accountType
            }
        });
    } catch (error) {
        console.error("Profile update error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to save profile. Please try again."
        });
    }
});

// ==================== SEND LEARNING REQUEST ====================

app.post("/api/skill-requests", verifyToken, async (req, res) => {
    try {
        const { receiverId, skill, message = "" } = req.body;

        if (
            typeof receiverId !== "string" ||
            !mongoose.isValidObjectId(receiverId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid user."
            });
        }

        if (
            typeof skill !== "string" ||
            !skill.trim() ||
            skill.trim().length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid skill."
            });
        }

        if (
            typeof message !== "string" ||
            message.length > 500
        ) {
            return res.status(400).json({
                success: false,
                message: "The message must be 500 characters or fewer."
            });
        }

        if (receiverId === req.userId) {
            return res.status(400).json({
                success: false,
                message: "You cannot send a request to yourself."
            });
        }

        const receiver = await User.findById(receiverId)
            .select("_id isActive skills");

        if (!receiver || !receiver.isActive) {
            return res.status(404).json({
                success: false,
                message: "This user is unavailable."
            });
        }

        // The requested skill must belong to the receiver's profile.
        const offeredSkills = (receiver.skills || []).map(
            item => String(item).trim().toLowerCase()
        );

        if (!offeredSkills.includes(skill.trim().toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "This user does not currently list that skill."
            });
        }

        const existingRequest = await SkillRequest.findOne({
            sender: req.userId,
            receiver: receiverId,
            skill: {
                $regex: "^" + skill.trim().replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                ) + "$",
                $options: "i"
            },
            status: { $in: ["Pending", "Accepted"] }
        });

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                message: "You already have a pending or accepted request for this skill."
            });
        }

        const request = await SkillRequest.create({
            sender: req.userId,
            receiver: receiverId,
            skill: skill.trim(),
            message: message.trim(),
            status: "Pending"
        });

        res.status(201).json({
            success: true,
            message: "Your learning request has been sent!",
            request: {
                id: request._id,
                skill: request.skill,
                message: request.message,
                status: request.status,
                createdAt: request.createdAt
            }
        });
    } catch (error) {
        console.error("Send learning request error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to send the learning request."
        });
    }
});

// ==================== VIEW REQUESTS RECEIVED ====================

app.get("/api/skill-requests/received", verifyToken, async (req, res) => {
    try {
        const requests = await SkillRequest.find({
            receiver: req.userId
        })
            .populate("sender", "name")
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            requests: requests.map(item => ({
                id: item._id,
                skill: item.skill,
                message: item.message,
                status: item.status,
                createdAt: item.createdAt,
                sender: item.sender
                    ? {
                        id: item.sender._id,
                        name: item.sender.name
                    }
                    : null
            }))
        });
    } catch (error) {
        console.error("Received requests error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load received requests."
        });
    }
});

// ==================== VIEW REQUESTS SENT ====================

app.get("/api/skill-requests/sent", verifyToken, async (req, res) => {
    try {
        const requests = await SkillRequest.find({
            sender: req.userId
        })
            .populate("receiver", "name")
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            requests: requests.map(item => ({
                id: item._id,
                skill: item.skill,
                message: item.message,
                status: item.status,
                createdAt: item.createdAt,
                receiver: item.receiver
                    ? {
                        id: item.receiver._id,
                        name: item.receiver.name
                    }
                    : null
            }))
        });
    } catch (error) {
        console.error("Sent requests error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load sent requests."
        });
    }
});

// ==================== ACCEPT OR DECLINE REQUEST ====================

app.patch(
    "/api/skill-requests/:id/status",
    verifyToken,
    async (req, res) => {
        try {
            const { status } = req.body;
            const requestId = req.params.id;

            if (!mongoose.isValidObjectId(requestId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid request ID."
                });
            }

            if (!["Accepted", "Declined"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Status must be Accepted or Declined."
                });
            }

            // Only the intended receiver can respond.
            const request = await SkillRequest.findOne({
                _id: requestId,
                receiver: req.userId
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Request not found."
                });
            }

            if (request.status !== "Pending") {
                return res.status(409).json({
                    success: false,
                    message: "This request has already been answered."
                });
            }

            request.status = status;
            await request.save();

            res.json({
                success: true,
                message: `Request ${status.toLowerCase()}.`,
                request: {
                    id: request._id,
                    skill: request.skill,
                    status: request.status
                }
            });
        } catch (error) {
            console.error("Update learning request error:", error.message);

            res.status(500).json({
                success: false,
                message: "Unable to update the request."
            });
        }
    }
);

// ==================== MARK REQUEST COMPLETED ====================
// Either participant can mark an accepted request completed.

app.patch(
    "/api/skill-requests/:id/complete",
    verifyToken,
    async (req, res) => {
        try {
            const requestId = req.params.id;

            if (!mongoose.isValidObjectId(requestId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid request ID."
                });
            }

            const request = await SkillRequest.findOne({
                _id: requestId,
                $or: [
                    { sender: req.userId },
                    { receiver: req.userId }
                ]
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Request not found."
                });
            }

            if (request.status !== "Accepted") {
                return res.status(400).json({
                    success: false,
                    message: "Only accepted requests can be completed."
                });
            }

            request.status = "Completed";
            await request.save();

            res.json({
                success: true,
                message: "Learning request marked as completed.",
                request: {
                    id: request._id,
                    skill: request.skill,
                    status: request.status
                }
            });
        } catch (error) {
            console.error("Complete request error:", error.message);

            res.status(500).json({
                success: false,
                message: "Unable to complete the request."
            });
        }
    }
);

// ==================== SAVE SKILL INTEREST ====================

app.post("/api/interests", verifyToken, async (req, res) => {
    try {
        const { skill } = req.body;

        if (typeof skill !== "string" || !skill.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid skill."
            });
        }

        const interest = await Interest.create({
            user: req.userId,
            skill: skill.trim()
        });

        res.status(201).json({
            success: true,
            message: "Your interest has been saved successfully!",
            interest: {
                id: interest._id,
                skill: interest.skill,
                status: interest.status,
                createdAt: interest.createdAt
            }
        });
    } catch (error) {
        console.error("Interest request error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to save your interest. Please try again."
        });
    }
});

// ==================== VIEW OWN INTERESTS ====================

app.get("/api/interests", verifyToken, async (req, res) => {
    try {
        const interests = await Interest.find({
            user: req.userId
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            interests: interests.map(item => ({
                id: item._id,
                skill: item.skill,
                status: item.status,
                createdAt: item.createdAt
            }))
        });
    } catch (error) {
        console.error("Fetch interests error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load your interests."
        });
    }
});

// ==================== CANCEL OWN PENDING INTEREST ====================

app.delete("/api/interests/:id", verifyToken, async (req, res) => {
    try {
        const interestId = req.params.id;

        if (!mongoose.isValidObjectId(interestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID."
            });
        }

        const interest = await Interest.findOne({
            _id: interestId,
            user: req.userId
        });

        if (!interest) {
            return res.status(404).json({
                success: false,
                message: "Skill request not found."
            });
        }

        if (interest.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "Only Pending requests can be cancelled."
            });
        }

        await Interest.findByIdAndDelete(interestId);

        res.json({
            success: true,
            message: "Your pending skill request was cancelled."
        });
    } catch (error) {
        console.error("Cancel interest error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to cancel your request."
        });
    }
});

// ==================== ADMIN: DASHBOARD SUMMARY ====================

app.get("/api/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            totalInterests,
            pendingInterests
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true }),
            Interest.countDocuments(),
            Interest.countDocuments({ status: "Pending" })
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                inactiveUsers: totalUsers - activeUsers,
                totalInterests,
                pendingInterests
            }
        });
    } catch (error) {
        console.error("Admin stats error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard statistics."
        });
    }
});

// ==================== ADMIN: VIEW AND SEARCH USERS ====================

app.get("/api/admin/users", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const search = typeof req.query.search === "string"
            ? req.query.search.trim()
            : "";

        const filter = {};

        if (search) {
            const escapedSearch = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                { name: { $regex: escapedSearch, $options: "i" } },
                { email: { $regex: escapedSearch, $options: "i" } }
            ];
        }

        const users = await User.find(filter)
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            users: users.map(user => ({
                id: user._id,
                name: user.name,
                email: user.email,
                age: user.age,
                role: user.role,
                skills: user.skills,
                bio: user.bio,
                accountType: user.accountType,
                isActive: user.isActive,
                createdAt: user.createdAt
            }))
        });
    } catch (error) {
        console.error("Admin users error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load users."
        });
    }
});

// ==================== ADMIN: ACTIVATE OR DEACTIVATE USERS ====================

app.patch(
    "/api/admin/users/:id/status",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const { isActive } = req.body;
            const targetId = req.params.id;

            if (!mongoose.isValidObjectId(targetId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID."
                });
            }

            if (typeof isActive !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "isActive must be true or false."
                });
            }

            if (targetId === req.userId && !isActive) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot deactivate your own admin account."
                });
            }

            const targetUser = await User.findById(targetId);

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }

            if (targetUser.accountType === "admin" && !isActive) {
                const activeAdmins = await User.countDocuments({
                    accountType: "admin",
                    isActive: true
                });

                if (activeAdmins <= 1) {
                    return res.status(400).json({
                        success: false,
                        message: "You cannot deactivate the last active admin."
                    });
                }
            }

            targetUser.isActive = isActive;
            await targetUser.save();

            res.json({
                success: true,
                message: isActive
                    ? "User activated successfully."
                    : "User deactivated successfully."
            });
        } catch (error) {
            console.error("Admin user status error:", error.message);

            res.status(500).json({
                success: false,
                message: "Unable to update user status."
            });
        }
    }
);

// ==================== ADMIN: VIEW ALL INTERESTS ====================

app.get(
    "/api/admin/interests",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const interests = await Interest.find()
                .populate("user", "name email")
                .sort({ createdAt: -1 })
                .lean();

            res.json({
                success: true,
                interests: interests.map(item => ({
                    id: item._id,
                    skill: item.skill,
                    status: item.status,
                    createdAt: item.createdAt,
                    user: item.user
                        ? {
                            id: item.user._id,
                            name: item.user.name,
                            email: item.user.email
                        }
                        : null
                }))
            });
        } catch (error) {
            console.error("Admin interests error:", error.message);

            res.status(500).json({
                success: false,
                message: "Unable to load skill requests."
            });
        }
    }
);

// ==================== ADMIN: UPDATE INTEREST STATUS ====================

app.patch(
    "/api/admin/interests/:id/status",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const { status } = req.body;

            const allowedStatuses = [
                "Pending",
                "Accepted",
                "Rejected",
                "Completed"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid interest status."
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid request ID."
                });
            }

            const interest = await Interest.findByIdAndUpdate(
                req.params.id,
                { $set: { status } },
                { new: true, runValidators: true }
            );

            if (!interest) {
                return res.status(404).json({
                    success: false,
                    message: "Skill request not found."
                });
            }

            res.json({
                success: true,
                message: "Skill request status updated.",
                interest: {
                    id: interest._id,
                    skill: interest.skill,
                    status: interest.status
                }
            });
        } catch (error) {
            console.error("Admin interest update error:", error.message);

            res.status(500).json({
                success: false,
                message: "Unable to update skill request."
            });
        }
    }
);

// ==================== NOT FOUND ====================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});

// ==================== DATABASE + START SERVER ====================

const PORT = process.env.PORT || 3000;

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing from .env");
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing from .env");
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");

        app.listen(PORT, () => {
            console.log(
                `SkillShareConnect server running at http://localhost:${PORT}`
            );
        });
    })
    .catch(error => {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    });
