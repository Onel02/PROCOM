const $ = (s) => document.querySelector(s);
const setMsg = (sel, text) => { $(sel).textContent = text; };

// Already signed in? Skip the form.
sb.auth.getSession().then(({ data }) => { if (data.session) location.href = "app.html"; });

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), up = e.submitter.value === "up";
  setMsg("#auth-msg", up ? "Creating account..." : "Signing in...");
  try {
    const { data, error } = up
      ? await DB.signUp(f.get("username"), f.get("password"))
      : await DB.signIn(f.get("username"), f.get("password"));
    if (error) throw error;
    if (data.session) location.href = "app.html";
    else setMsg("#auth-msg", "Account created, but Supabase still wants email confirmation. Turn off 'Confirm email' in Authentication settings.");
  } catch (err) {
    console.error(err);
    setMsg("#auth-msg", err.message);
  }
});