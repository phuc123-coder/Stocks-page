// ---------- Authentication ----------
document.addEventListener("DOMContentLoaded", () => {
  // Login
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.email === email && user.password === password) {
        alert("Login successful!");
        window.location.href = "index.html";
      } else {
        alert("Invalid credentials.");
      }
    });
  }

  // Signup
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("signupEmail").value;
      const password = document.getElementById("signupPassword").value;
      const rePassword = document.getElementById("signupRePassword").value;

      if (password !== rePassword) {
        alert("Passwords do not match!");
        return;
      }

      localStorage.setItem("user", JSON.stringify({ email, password }));
      alert("Signup successful!");
      window.location.href = "login.html";
    });
  }
});
