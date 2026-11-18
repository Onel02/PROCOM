const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Perenual's free tier returns "Upgrade Plans..." strings for locked fields
const clean = (v) => Array.isArray(v) ? v.join(", ") : (typeof v === "string" && !/upgrade/i.test(v) ? v : "Unknown");
const setMsg = (sel, text) => { $(sel).textContent = text; };

let currentUser = null, currentPlant = null, garden = [], lastResults = [];

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ---------- Navigation ----------
const currentView = () => (location.pathname.endsWith("/garden") ? "garden" : "explore");

function showView(name, push = true) {
  for (const v of ["explore", "garden"]) $("#view-" + v).hidden = v !== name;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  const path = name === "garden" ? "/garden" : "/app";
  if (push && location.pathname !== path) history.pushState(null, "", path);
}
document.querySelector("nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) showView(b.dataset.view);
});
window.addEventListener("popstate", () => showView(currentView(), false));

// ---------- Explore: search + details ----------
const LIGHT_TERMS = { low: ["low"], indirect: ["indirect"], sun: ["full sun"], shade: ["partial shade", "part shade", "part sun"] };
const matchesLight = (p, key) => LIGHT_TERMS[key].some((t) => clean(p.sunlight).toLowerCase().includes(t));

async function runSearch() {
  const q = $("#q").value.trim(), light = $("#light-filter").value;
  if (!q && !light) return showRecommended();
  setMsg("#explore-msg", "Searching...");
  try {
    let list = q ? await Api.search(q) : await Api.local(); // filter only: browse our whole list
    if (light) list = list.filter((p) => matchesLight(p, light));
    showResults(list);
    setMsg("#explore-msg", list.length ? `${list.length} plant(s)` : "No plants found. Try another name or light level.");
  } catch (err) {
    setMsg("#explore-msg", "Could not load plants: " + err.message);
  }
}
$("#search-form").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
$("#light-filter").addEventListener("change", runSearch);

$("#results").addEventListener("click", (e) => {
  const b = e.target.closest("[data-id]");
  if (b) openPlant(b.dataset.id);
});

async function openPlant(id) {
  $("#plant-body").textContent = "Loading...";
  $("#plant-dialog").showModal();
  try {
    const item = lastResults.find((x) => String(x.id) === String(id));
    let p = item;
    if (!item?.local) {
      try { p = await Api.details(id); }
      catch (err) {
        // 429 etc: fall back to the data we already have from the search list
        if (!item) throw err;
        toast("Plant API limit reached: showing basic info");
      }
    }
    const [wiki] = await Promise.allSettled([Api.wiki(p.local ? p.scientific_name[0] : (p.common_name || p.scientific_name?.[0]))]);
    const w = wiki.status === "fulfilled" ? wiki.value : null;
    currentPlant = { ...p, wikiImage: w?.thumbnail?.source };
    $("#plant-body").innerHTML = `
      ${(p.default_image?.regular_url ?? w?.thumbnail?.source) ? `<img src="${esc(p.default_image?.regular_url ?? w.thumbnail.source)}" alt="">` : ""}
      <h2>${esc(p.common_name)}</h2>
      <p class="sci">${esc(p.scientific_name?.[0])}</p>
      <p><b>Sunlight:</b> ${esc(clean(p.sunlight))}<br><b>Watering:</b> ${esc(clean(p.watering))}${p.water_every_days ? ` (about every ${p.water_every_days} days)` : ""}</p>
      <p>${esc(w?.extract || (typeof p.description === "string" && !/upgrade/i.test(p.description) ? p.description : "No description available."))}</p>
      ${w?.content_urls ? `<a href="${esc(w.content_urls.desktop.page)}" target="_blank" rel="noopener">Read more on Wikipedia</a>` : ""}
      <button id="add-btn">Add to my garden</button>`;
  } catch (err) {
    $("#plant-body").textContent = "Could not load details: " + err.message;
  }
}

$("#plant-body").addEventListener("click", async (e) => {
  if (e.target.id !== "add-btn") return;
  if (!currentUser) { location.href = "login.html"; return; }
  try {
    await DB.addPlant({
      perenual_id: currentPlant.id,
      name: currentPlant.common_name,
      image_url: currentPlant.default_image?.thumbnail ?? currentPlant.wikiImage ?? null,
      sunlight: clean(currentPlant.sunlight),
      water_every_days: currentPlant.water_every_days ?? Api.waterDays(currentPlant.watering),
    });
    $("#plant-dialog").close();
    toast("Added to your garden");
    loadGarden();
  } catch (err) { toast(err.message); }
});

function showResults(list) {
  lastResults = list;
  $("#results").innerHTML = list.map((p) => `
    <article class="card" data-card="${p.id}">
      ${p.default_image?.thumbnail ? `<img src="${esc(p.default_image.thumbnail)}" alt="">` : ""}
      <h3>${esc(p.common_name)}</h3>
      <p class="sci">${esc(p.scientific_name?.[0])}</p>
      <button data-id="${p.id}">View details</button>
    </article>`).join("");
  fillImages(list);
}

// Explore opens with random picks from our local list (instant, no API call)
async function showRecommended() {
  try {
    const picks = [...(await Api.local())].sort(() => Math.random() - 0.5).slice(0, 8);
    showResults(picks);
    setMsg("#explore-msg", "Recommended plants");
  } catch (err) { setMsg("#explore-msg", "Could not load plants: " + err.message); }
}

// Clearing the search box brings the recommendations back
$("#q").addEventListener("input", () => { if (!$("#q").value.trim()) runSearch(); });

// Local plants have no photos: load each from Wikipedia (cached in localStorage)
function fillImages(list) {
  for (const p of list.filter((x) => x.local)) {
    Api.wiki(p.scientific_name[0]).then((w) => {
      const card = document.querySelector(`[data-card="${p.id}"]`);
      if (w.thumbnail?.source && card) card.insertAdjacentHTML("afterbegin", `<img src="${esc(w.thumbnail.source)}" alt="">`);
    }).catch(() => {});
  }
}

// ---------- Garden ----------
const daysSince = (date) => Math.floor((Date.now() - new Date(date)) / 864e5);
const daysLeft = (g) => g.water_every_days - daysSince(g.last_watered);

async function loadGarden() {
  try { garden = currentUser ? await DB.gardenList() : []; }
  catch (err) { setMsg("#garden-msg", err.message); return; }
  setMsg("#garden-msg", !currentUser ? "Sign in to see your garden." : garden.length ? "" : "Your garden is empty. Find a plant in Explore and add it.");
  $("#garden").innerHTML = garden.map(gardenCard).join("");
  renderToday();
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
      <button data-act="details" data-id="${g.id}" class="ghost">Details</button>
    </article>`;
}

$("#view-garden").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  try {
    if (b.dataset.act === "details") return openGardenDialog(b.dataset.id);
    if (b.dataset.act === "water") await DB.markWatered(b.dataset.id);
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

// ---------- Garden details popup: chart, note, info, remove ----------
let openId = null;

// Hand-made SVG line chart of height (cm) per log entry
function growthChart(logs) {
  if (!logs.length) return '<p class="msg">No height logs yet. Log a height on the plant\'s card to see its growth here.</p>';
  const W = 400, H = 180, L = 48, R = 16, T = 20, B = 32;
  const hs = logs.map((l) => Number(l.height_cm)), max = Math.max(...hs, 1);
  // Y axis from 0 cm, about 4 even steps of 1, 2 or 5 x 10^n cm (e.g. 0, 5, 10, 15)
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((m) => m * mag >= raw) * mag;
  const ticks = Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(2));
  const x = (i) => logs.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (logs.length - 1);
  const y = (h) => H - B - (h / ticks.at(-1)) * (H - B - T);
  const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t} cm</text>`).join("");
  const pts = hs.map((h, i) => `${x(i)},${y(h)}`).join(" ");
  // Each point: a bigger invisible circle to hover, the dot, and a label shown on hover
  const dots = logs.map((l, i) => `<g class="pt">
    <circle class="hit" cx="${x(i)}" cy="${y(hs[i])}" r="12"/><circle cx="${x(i)}" cy="${y(hs[i])}" r="4"/>
    <text x="${x(i)}" y="${y(hs[i]) - 10}" text-anchor="middle">${esc(l.height_cm)} cm</text>
    <title>${esc(l.logged_on)}: ${esc(l.height_cm)} cm</title></g>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Plant height over time">
    ${grid}<polyline points="${pts}"/>${dots}
    <text x="${L}" y="${H - 8}">${esc(logs[0].logged_on)}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end">${esc(logs.at(-1).logged_on)}</text>
  </svg>`;
}

function openGardenDialog(id) {
  const g = garden.find((x) => x.id === id);
  if (!g) return;
  openId = id;
  const logs = [...(g.growth_logs || [])].sort((a, b) => a.logged_on.localeCompare(b.logged_on));
  const last = logs.at(-1), left = daysLeft(g);
  $("#garden-body").innerHTML = `
    ${g.image_url ? `<img src="${esc(g.image_url)}" alt="">` : ""}
    <h2>${esc(g.name)}</h2>
    <h3>Growth</h3>
    ${growthChart(logs)}
    <p>
      <b>Sunlight:</b> ${esc(g.sunlight)}<br>
      <b>Watering:</b> every ${g.water_every_days} days (last: ${esc(g.last_watered)}, ${left <= 0 ? "due now" : `next in ${left} day(s)`})<br>
      <b>Latest height:</b> ${last ? `${esc(last.height_cm)} cm` : "none logged"} (${logs.length} logs)<br>
      <b>Added:</b> ${esc(g.created_at.slice(0, 10))}
    </p>
    <h3>Note</h3>
    <textarea id="note-text" rows="3" maxlength="500" placeholder="Where it sits, how it's doing...">${esc(g.note)}</textarea>
    <p id="dialog-msg" class="msg"></p>
    <div class="row">
      <button data-act="save-note">Save note</button>
      <button data-act="remove" class="ghost">Remove plant</button>
    </div>`;
  $("#garden-dialog").showModal();
}

$("#garden-dialog").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  try {
    if (b.dataset.act === "save-note") {
      await DB.saveNote(openId, $("#note-text").value);
      setMsg("#dialog-msg", "Note saved.");
      loadGarden();
    }
    if (b.dataset.act === "remove" && confirm("Remove this plant from your garden?")) {
      await DB.removePlant(openId);
      $("#garden-dialog").close();
      toast("Plant removed");
      loadGarden();
    }
  } catch (err) { setMsg("#dialog-msg", err.message); }
});

// ---------- Today list (plants that need water) ----------
function renderToday() {
  const due = garden.filter((g) => daysLeft(g) <= 0).sort((a, b) => daysLeft(a) - daysLeft(b));
  $("#today").hidden = !garden.length;
  $("#today").classList.toggle("has-due", due.length > 0);
  $("#today-list").innerHTML = due.length ? due.map((g) => `
    <li>
      <span>${esc(g.name)} <small>${daysLeft(g) < 0 ? `${-daysLeft(g)} day(s) overdue` : "due today"}</small></span>
      <button data-act="water" data-id="${g.id}">Watered</button>
    </li>`).join("") : "<li>All caught up. Nothing needs water today.</li>";
  $("#due-badge").hidden = !due.length;
  $("#due-badge").textContent = due.length;
}
setInterval(renderToday, 60 * 60 * 1000); // refresh if the page stays open past midnight

// ---------- Auth ----------
$("#auth-btn").addEventListener("click", () => currentUser ? DB.signOut() : (location.href = "login.html"));

function setUser(user) {
  currentUser = user ?? null;
  $("#user-email").textContent = currentUser?.email.split("@")[0] ?? "";
  $("#auth-btn").textContent = currentUser ? "Sign out" : "Sign in";
  loadGarden();
}

// ---------- Start ----------
showView(currentView(), false);
showRecommended();
sb.auth.getSession().then(({ data }) => setUser(data.session?.user));
sb.auth.onAuthStateChange((_event, session) => setUser(session?.user));