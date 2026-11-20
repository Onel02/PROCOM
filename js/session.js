// after_login.html only: show the username (pill, dropdown, heading) and run the user dropdown.
const userBtn = document.getElementById("user-btn");
const userLabel = document.getElementById("username");
const userMenu = document.getElementById("user-menu");

function renderUser(user) {
  // The username exactly as typed at sign-up (kept in user_metadata). Older accounts have none, so they fall back to the lowercase email name.
  const name = user.user_metadata?.username || user.email.split("@")[0];
  userLabel.textContent = name.length > 8 ? name.slice(0, 7) + "…" : name; // keep it inside the pill
  document.getElementById("user-fullname").textContent = name;
  document.getElementById("post-title").textContent = name + "’s Little Green Corner";
}

// The login check itself is done by js/guard.js (loaded in the <head>)
sb.auth.getSession().then(({ data }) => { if (data.session) renderUser(data.session.user); });

// ---------- Dropdown ----------
function setMenu(open) {
  userMenu.hidden = !open;
  userBtn.setAttribute("aria-expanded", String(open));
}
const toggleMenu = () => setMenu(userMenu.hidden);

userBtn.addEventListener("click", toggleMenu);
userBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMenu(); }
});
document.addEventListener("click", (e) => { if (!userBtn.parentElement.contains(e.target)) setMenu(false); }); // click outside
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setMenu(false); userBtn.focus(); } });

// Supabase does not throw: it returns { error }. On success guard.js sends the visitor to before_login.html.
const signOutBtn = document.getElementById("signout-btn");
signOutBtn.addEventListener("click", async () => {
  signOutBtn.disabled = true;
  try {
    const { error } = await DB.signOut();
    if (error) throw error;
  } catch (err) {
    alert("Could not sign out: " + err.message);
    signOutBtn.disabled = false;
  }
});

// ---------- Watering badge on "Personal Garden" ----------
const dueBadge = document.getElementById("due-badge");
DB.dueCount().then((n) => {
  dueBadge.textContent = n;
  dueBadge.hidden = !n;
  dueBadge.title = n === 1 ? "1 plant needs water" : n + " plants need water";
}).catch(() => {});