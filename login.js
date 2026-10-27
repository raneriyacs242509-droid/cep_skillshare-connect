
/* SkillShareConnect - Login */

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const loginMessage = document.getElementById("loginMessage");

    // If already logged in, open the normal user dashboard.
    const existingToken = sessionStorage.getItem("token");
    const existingUser = sessionStorage.getItem("user");

    if (existingToken && existingUser) {
        try {
            JSON.parse(existingUser);
            window.location.replace("dashboard.html");
            return;
        } catch (error) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
        }
    }

    if (!loginForm) return;

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        loginMessage.textContent = "Logging in...";
        loginMessage.style.color = "#416b54";

        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok || data.success === false || !data.token) {
                throw new Error(data.message || "Invalid email or password.");
            }

            // Save login details for the normal user session.
            sessionStorage.setItem("token", data.token);

            if (data.user) {
                sessionStorage.setItem("user", JSON.stringify(data.user));
            } else {
                sessionStorage.setItem("user", JSON.stringify({
                    id: data.userId || data.id || "",
                    email: email,
                    accountType: data.accountType || "user"
                }));
            }

            loginMessage.textContent = "Login successful! Opening your dashboard...";
            loginMessage.style.color = "#2e7d32";

            // Never redirect to the Admin page.
            window.location.replace("dashboard.html");

        } catch (error) {
            loginMessage.textContent =
                error.message || "Unable to log in. Please try again.";
            loginMessage.style.color = "#c62828";
            submitButton.disabled = false;
        }
    });
});
