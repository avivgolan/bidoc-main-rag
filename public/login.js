const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const submitButton = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.style.display = "none";
  submitButton.disabled = true;
  submitButton.textContent = "מתחבר...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "ההתחברות נכשלה");
    location.href = "/";
  } catch (error) {
    errorBox.textContent = error.message || "ההתחברות נכשלה";
    errorBox.style.display = "block";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "התחבר";
  }
});
