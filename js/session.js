// after_login.html only: show the username (pill, dropdown, heading) and run the user dropdown.
const userBtn = document.getElementById("user-btn");
const userLabel = document.getElementById("username");
const userMenu = document.getElementById("user-menu");

function renderUser(user) {
  const name = user.email.split("@")[0]; // the username (db.js stores it as username@AUTH_DOMAIN)
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  userLabel.textContent = name.length > 8 ? name.slice(0, 7) + "…" : name; // keep it inside the pill
  document.getElementById("user-fullname").textContent = name;
  document.getElementById("post-title").textContent = pretty + "’s Little Green Corner";
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

document.getElementById("signout-btn").addEventListener("click", () => DB.signOut());

// ---------- Watering badge on "Personal Garden" ----------
const dueBadge = document.getElementById("due-badge");
DB.dueCount().then((n) => {
  dueBadge.textContent = n;
  dueBadge.hidden = !n;
  dueBadge.title = n === 1 ? "1 plant needs water" : n + " plants need water";
}).catch(() => {});