const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Perenual's free tier returns "Upgrade Plans..." strings for locked fields
const clean = (v) => Array.isArray(v) ? v.join(", ") : (typeof v === "string" && !/upgrade/i.test(v) ? v : "Unknown");
const setMsg = (sel, text) => { $(sel).textContent = text; };

let currentUser = null, currentPlant = null, garden = [];

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ---------- Navigation ----------
function showView(name) {
  for (const v of ["explore", "garden"]) $("#view-" + v).hidden = v !== name;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
}
document.querySelector("nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) showView(b.dataset.view);
});

// ---------- Explore: search + details ----------
$("#search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#q").value.trim();
  localStorage.setItem("lastQuery", q);
  setMsg("#explore-msg", "Searching...");
  try {
    const list = await Api.search(q);
    $("#results").innerHTML = list.map((p) => `
      <article class="card">
        ${p.default_image?.thumbnail ? `<img src="${esc(p.default_image.thumbnail)}" alt="">` : ""}
        <h3>${esc(p.common_name)}</h3>
        <p class="sci">${esc(p.scientific_name?.[0])}</p>
        <button data-id="${p.id}">View details</button>
      </article>`).join("");
    setMsg("#explore-msg", list.length ? "" : "No plants found. Try another name.");
  } catch (err) {
    setMsg("#explore-msg", "Could not load plants: " + err.message);
  }
});

$("#results").addEventListener("click", (e) => {
  const b = e.target.closest("[data-id]");
  if (b) openPlant(b.dataset.id);
});

async function openPlant(id) {
  $("#plant-body").textContent = "Loading...";
  $("#plant-dialog").showModal();
  try {
    const p = await Api.details(id);
    const [wiki] = await Promise.allSettled([Api.wiki(p.common_name || p.scientific_name?.[0])]);
    const w = wiki.status === "fulfilled" ? wiki.value : null;
    currentPlant = p;
    $("#plant-body").innerHTML = `
      ${p.default_image?.regular_url ? `<img src="${esc(p.default_image.regular_url)}" alt="">` : ""}
      <h2>${esc(p.common_name)}</h2>
      <p class="sci">${esc(p.scientific_name?.[0])}</p>
      <p><b>Sunlight:</b> ${esc(clean(p.sunlight))}<br><b>Watering:</b> ${esc(clean(p.watering))}</p>
      <p>${esc(w?.extract || (typeof p.description === "string" && !/upgrade/i.test(p.description) ? p.description : "No description available."))}</p>
      ${w?.content_urls ? `<a href="${esc(w.content_urls.desktop.page)}" target="_blank" rel="noopener">Read more on Wikipedia</a>` : ""}
      <button id="add-btn">Add to my garden</button>`;
  } catch (err) {
    $("#plant-body").textContent = "Could not load details: " + err.message;
  }
}

$("#plant-body").addEventListener("click", async (e) => {
  if (e.target.id !== "add-btn") return;
  if (!currentUser) { $("#plant-dialog").close(); $("#auth-dialog").showModal(); return; }
  try {
    await DB.addPlant({
      perenual_id: currentPlant.id,
      name: currentPlant.common_name,
      image_url: currentPlant.default_image?.thumbnail ?? null,
      sunlight: clean(currentPlant.sunlight),
      water_every_days: Api.waterDays(currentPlant.watering),
    });
    $("#plant-dialog").close();
    toast("Added to your garden");
    loadGarden();
  } catch (err) { toast(err.message); }
});

// ---------- Garden ----------
const daysSince = (date) => Math.floor((Date.now() - new Date(date)) / 864e5);
const daysLeft = (g) => g.water_every_days - daysSince(g.last_watered);

async function loadGarden() {
  try { garden = currentUser ? await DB.gardenList() : []; }
  catch (err) { setMsg("#garden-msg", err.message); return; }
  setMsg("#garden-msg", !currentUser ? "Sign in to see your garden." : garden.length ? "" : "Your garden is empty. Find a plant in Explore and add it.");
  $("#garden").innerHTML = garden.map(gardenCard).join("");
  checkReminders();
}

function gardenCard(g) {
  const logs = (g.growth_logs || []).sort((a, b) => a.logged_on.localeCompare(b.logged_on));
  const last = logs.at(-1), left = daysLeft(g);
  return `
    <article class="card ${left <= 0 ? "due" : ""}">
      ${g.image_url ? `<img src="${esc(g.image_url)}" alt="">` : ""}
      <h3>${esc(g.name)}</h3>
      <p>Sun: ${esc(g.sunlight)}</p>
      <p class="${left <= 0 ? "due-text" : ""}">${left <= 0 ? "Needs water now" : `Water in ${left} day(s)`}</p>
      <p>Growth: ${last ? `${esc(last.height_cm)} cm (${logs.length} logs)` : "no logs yet"}</p>
      <button data-act="water" data-id="${g.id}">Watered today</button>
      <form data-act="log" data-id="${g.id}" class="row">
        <input name="h" type="number" step="0.1" min="0" placeholder="Height (cm)" required><button class="ghost">Log</button>
      </form>
      <button data-act="remove" data-id="${g.id}" class="ghost">Remove</button>
    </article>`;
}

$("#garden").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  try {
    if (b.dataset.act === "water") await DB.markWatered(b.dataset.id);
    if (b.dataset.act === "remove" && confirm("Remove this plant?")) await DB.removePlant(b.dataset.id);
    loadGarden();
  } catch (err) { toast(err.message); }
});

$("#garden").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await DB.addLog(e.target.dataset.id, e.target.h.value);
    loadGarden();
  } catch (err) { toast(err.message); }
});

// ---------- Reminders (only work while the site is open in a tab) ----------
function checkReminders() {
  const due = garden.filter((g) => daysLeft(g) <= 0);
  $("#due-badge").hidden = !due.length;
  $("#due-badge").textContent = due.length;
  const key = "notified:" + new Date().toISOString().slice(0, 10);
  if (due.length && Notification.permission === "granted" && !localStorage.getItem(key)) {
    localStorage.setItem(key, "1");
    new Notification("Time to water", { body: due.map((g) => g.name).join(", ") });
  }
}
setInterval(checkReminders, 60 * 60 * 1000);

$("#notif-btn").addEventListener("click", async () => {
  const result = await Notification.requestPermission();
  toast(result === "granted" ? "Reminders on" : "Reminders blocked by the browser");
  checkReminders();
});

// ---------- Auth ----------
$("#auth-btn").addEventListener("click", () => currentUser ? DB.signOut() : $("#auth-dialog").showModal());

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), up = e.submitter.value === "up";
  const { error } = up ? await DB.signUp(f.get("email"), f.get("password")) : await DB.signIn(f.get("email"), f.get("password"));
  if (error) return setMsg("#auth-msg", error.message);
  setMsg("#auth-msg", "");
  $("#auth-dialog").close();
  toast(up ? "Account created. Confirm your email if asked, then sign in." : "Signed in");
});

function setUser(user) {
  currentUser = user ?? null;
  $("#user-email").textContent = currentUser?.email ?? "";
  $("#auth-btn").textContent = currentUser ? "Sign out" : "Sign in";
  loadGarden();
}

// ---------- Start ----------
$("#q").value = localStorage.getItem("lastQuery") || "";
sb.auth.getSession().then(({ data }) => setUser(data.session?.user));
sb.auth.onAuthStateChange((_event, session) => setUser(session?.user));
