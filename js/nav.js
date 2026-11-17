// Landing page: show the logged-in state in the header (app.html does this inside app.js)
const authLink = document.querySelector("#auth-link");
let signedIn = false;

function renderAuth(user) {
  signedIn = !!user;
  document.querySelector("#user-name").textContent = user ? user.email.split("@")[0] : "";
  document.querySelector("#hero-login").hidden = signedIn;
  authLink.textContent = signedIn ? "Sign out" : "Log in";
  authLink.href = signedIn ? "#" : "login.html";
}

authLink.addEventListener("click", (e) => {
  if (signedIn) { e.preventDefault(); DB.signOut(); }
});

sb.auth.getSession().then(({ data }) => renderAuth(data.session?.user));
sb.auth.onAuthStateChange((_event, session) => renderAuth(session?.user));