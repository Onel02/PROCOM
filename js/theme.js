// Light/dark theme: saved choice, else the system setting. Loaded in <head> so the page never flashes.
document.documentElement.dataset.theme = localStorage.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

document.addEventListener("click", (e) => {
  if (!e.target.closest("#theme-btn")) return;
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = localStorage.theme = t;
});
