
const token = sessionStorage.getItem("token");
const savedUser = sessionStorage.getItem("user");

const form = document.getElementById("profileForm");
const message = document.getElementById("message");
const otherSkillCheckbox = document.getElementById("otherSkillCheckbox");
const customSkillBox = document.getElementById("customSkillBox");
const customSkillsInput = document.getElementById("customSkills");

// Skills already listed on the website
const predefinedSkills = [
    "Teaching",
    "Technology",
    "Computer Science",
    "Art and Design",
    "Sports and Fitness",
    "Cooking",
    "Communication",
    "Repair Skills",
    "Community Support"
];

if (!token || !savedUser) {
    window.location.replace("login.html");
} else {
    loadProfile();
}

// LOAD EXISTING PROFILE
async function loadProfile() {
    try {
        // Load the latest profile from the server
        const response = await fetch("/api/me", {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to load profile.");
        }

        const user = result.user;
        const userSkills = Array.isArray(user.skills) ? user.skills : [];

        document.getElementById("name").value = user.name || "";
        document.getElementById("age").value = user.age || "";
        document.getElementById("role").value = user.role || "Other";
        document.getElementById("bio").value = user.bio || "";

        // Check predefined skills that the user has selected
        document.querySelectorAll('input[name="skills"]').forEach(input => {
            input.checked = userSkills.includes(input.value);
        });

        // Keep skills that aren't in the predefined list as custom skills.
        // "Other" is an old checkbox value, so don't show it as a custom skill.
        const customSkills = userSkills.filter(skill =>
            !predefinedSkills.includes(skill) &&
            skill.trim().toLowerCase() !== "other"
        );

        customSkillsInput.value = customSkills.join(", ");

        // Show the custom skills box if the user already has custom skills
        otherSkillCheckbox.checked = customSkills.length > 0;
        customSkillBox.hidden = !otherSkillCheckbox.checked;

        // Refresh the browser's saved user data
        sessionStorage.setItem("user", JSON.stringify(user));

    } catch (error) {
        message.textContent =
            error.message || "Unable to load your profile. Please log in again.";
        message.style.color = "#B42318";
    }
}

// SHOW OR HIDE CUSTOM SKILLS
otherSkillCheckbox.addEventListener("change", function () {
    customSkillBox.hidden = !this.checked;

    if (!this.checked) {
        customSkillsInput.value = "";
    }
});

// SAVE PROFILE TO MONGODB
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.textContent = "Saving your profile...";
    message.style.color = "#416b54";

    const selectedSkills = Array.from(
        document.querySelectorAll('input[name="skills"]:checked')
    ).map(input => input.value);

    // Split custom skills using commas or new lines
    const customSkills = otherSkillCheckbox.checked
        ? customSkillsInput.value
            .split(/[,\n]/)
            .map(skill => skill.trim())
            .filter(skill => skill.length > 0)
        : [];

    // Combine predefined and custom skills, removing duplicates
    const allSkills = [...new Set(
        [...selectedSkills, ...customSkills].filter(
            skill => skill.toLowerCase() !== "other"
        )
    )];

    const data = {
        name: document.getElementById("name").value.trim(),
        age: document.getElementById("age").value,
        role: document.getElementById("role").value,
        bio: document.getElementById("bio").value.trim(),
        skills: allSkills
    };

    if (!data.name) {
        message.textContent = "Please enter your name.";
        message.style.color = "#B42318";
        return;
    }

    try {
        const response = await fetch("/api/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to save profile.");
        }

        // Update the saved user data in the browser
        sessionStorage.setItem("user", JSON.stringify(result.user));

        message.textContent = "Profile saved successfully!";
        message.style.color = "#287443";

    } catch (error) {
        message.textContent =
            error.message || "Unable to connect to the server.";
        message.style.color = "#B42318";
    }
});
