// Login page logic: connects the flip-card forms in login.html to Supabase (via DB in js/db.js).
// Errors are shown with the browser's own validation bubble, so no extra markup or CSS is needed.
const AFTER_LOGIN = "after_login.html";
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function showError(input, text) {
  input.setCustomValidity(text);
  input.reportValidity();
}

// Turn Supabase's error text into something friendly, and say which field it belongs to.
function explain(message) {
  if (/invalid login/i.test(message)) return ["password", "Wrong username or password."];
  if (/already registered/i.test(message)) return ["username", "That username is already taken."];
  if (/password/i.test(message)) return ["password", message];
  return ["username", message];
}

function wire(formId, action) {
  const form = document.getElementById(formId);
  const btn = form.querySelector("button");
  // Clear an old error as soon as the person starts typing again
  form.querySelectorAll("input").forEach((i) => i.addEventListener("input", () => i.setCustomValidity("")));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const username = String(f.get("username")).trim(), password = String(f.get("password"));
    const uInput = form.elements.username, pInput = form.elements.password;

    if (!USERNAME_RE.test(username)) return showError(uInput, "Username: 3-20 letters, numbers or _ only.");
    if (password.length < 6) return showError(pInput, "Password needs at least 6 characters.");

    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Please wait...";
    try {
      const { data, error } = await action(username, password);
      if (error) throw error;
      if (!data.session) return showError(uInput, "Account created, but Supabase wants email confirmation. Turn off 'Confirm email' in Authentication settings.");
      location.href = AFTER_LOGIN;
    } catch (err) {
      console.error(err);
      const [field, text] = explain(err.message || "Something went wrong.");
      showError(form.elements[field], text);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}

wire("login-form", DB.signIn);
wire("signup-form", DB.signUp);