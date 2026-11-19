// For pages that are only for signed-in users (after_login.html, garden.html, ...).
// Load it in the <head>, right after supabase-js, config.js and db.js, so the page stays hidden
// until we know the visitor is logged in (no flash of the page for strangers).
document.documentElement.style.visibility = "hidden";

sb.auth.getSession().then(({ data }) => {
  if (!data.session) location.replace("login.html"); // not logged in -> go log in
  else document.documentElement.style.visibility = "";
});

// Signed out (in this tab or another one) -> back to the public page
sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("before_login.html"); });