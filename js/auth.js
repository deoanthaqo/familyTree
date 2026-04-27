document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const errorMessage = document.getElementById("errorMessage");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      try {
        const response = await fetch("./js/data.json");
        const data = await response.json();

        const user = data.users.find(
          (u) => u.username === username && u.password === password,
        );

        if (user) {
          sessionStorage.setItem("isLoggedIn", "true");
          sessionStorage.setItem("username", username);
          window.location.href = "dashboard.html";
        } else {
          errorMessage.textContent = "Username atau password salah!";
          errorMessage.style.display = "block";
        }
      } catch (error) {
        errorMessage.textContent = "Terjadi kesalahan. Silakan coba lagi.";
        errorMessage.style.display = "block";
        console.error("Login error:", error);
      }
    });
  }

  // Check if user is logged in on dashboard
  if (window.location.pathname.includes("dashboard.html")) {
    if (!sessionStorage.getItem("isLoggedIn")) {
      window.location.href = "index.html";
    }
  }
});

function logout() {
  sessionStorage.removeItem("isLoggedIn");
  sessionStorage.removeItem("username");
  window.location.href = "index.html";
}
