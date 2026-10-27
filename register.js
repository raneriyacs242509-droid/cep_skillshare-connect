
const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    registerMessage.textContent = "Creating your account...";
    registerMessage.style.color = "#557761";

    // Get skills selected from the checkboxes
    const skills = Array.from(
        document.querySelectorAll('input[name="skills"]:checked')
    ).map(input => input.value);

    // Get custom skills entered by the user
    const customSkillsText =
        document.getElementById("customSkills")?.value.trim() || "";

    // Split custom skills by commas and remove empty entries
    const customSkills = customSkillsText
        .split(",")
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

    // Combine selected and custom skills without duplicates
    const allSkills = [...new Set([...skills, ...customSkills])];

    const data = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
        age: document.getElementById("age").value,
        role: document.getElementById("role").value,
        skills: allSkills,
        customSkills: customSkills,
        bio: document.getElementById("bio")?.value.trim() || ""
    };

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Registration failed.");
        }

        registerMessage.textContent =
            "Account created successfully! Redirecting to login...";
        registerMessage.style.color = "#287443";

        registerForm.reset();

        const customSkillBox = document.getElementById("customSkillBox");
        if (customSkillBox) {
            customSkillBox.hidden = true;
        }

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {
        registerMessage.textContent =
            error.message || "Unable to connect. Please try again.";
        registerMessage.style.color = "#B42318";
    }
});
