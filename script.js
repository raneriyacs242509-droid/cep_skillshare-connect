
/* SkillShareConnect - Homepage and Navigation */

document.addEventListener("DOMContentLoaded", function () {
    console.log("SkillShareConnect website loaded successfully!");

    // Smooth scrolling for homepage sections
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            const target = document.querySelector(link.getAttribute("href"));

            if (target) {
                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    // Update navigation according to login status
    updateNavigation();
});

function updateNavigation() {
    const token = sessionStorage.getItem("token");
    const savedUser = sessionStorage.getItem("user");

    let loggedIn = false;

    try {
        if (token && savedUser) {
            JSON.parse(savedUser);
            loggedIn = true;
        }
    } catch (error) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
    }

    // Hide login and sign-up links after login
    const loginLink = document.getElementById("loginLink");
    const joinLink = document.getElementById("joinLink");

    if (loginLink) {
        loginLink.style.display = loggedIn ? "none" : "inline-block";
    }

    if (joinLink) {
        joinLink.style.display = loggedIn ? "none" : "inline-block";
    }

    // Show dashboard only after login
    const dashboardLink = document.getElementById("dashboardLink");

    if (dashboardLink) {
        dashboardLink.style.display = loggedIn ? "inline-block" : "none";
    }

    // Show Find Skills only after login
    const findSkillsLink = document.getElementById("findSkillsLink");

    if (findSkillsLink) {
        findSkillsLink.style.display = loggedIn ? "inline-block" : "none";
    }

    // Update homepage buttons
    const startSharingLink = document.getElementById("startSharingLink");
    const joinCommunityLink = document.getElementById("joinCommunityLink");

    if (startSharingLink && loggedIn) {
        startSharingLink.href = "dashboard.html";
        startSharingLink.textContent = "Open My Dashboard →";
    } else if (startSharingLink) {
        startSharingLink.href = "register.html";
        startSharingLink.textContent = "Start Sharing Skills →";
    }

    if (joinCommunityLink) {
        joinCommunityLink.style.display = loggedIn ? "none" : "inline-block";
    }
}
