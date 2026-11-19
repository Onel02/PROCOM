// garden.html: your personal garden.
// Draws the plant cards, runs the "Add Plants" popup (search + details) and the growth-log popup.
// Load order: supabase-js, js/config.js, js/db.js, js/guard.js (in the <head>), then js/api.js and this file.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Perenual's free tier returns "Upgrade Plans..." strings for locked fields
const clean = (v) => Array.isArray(v) ? v.join(", ") : (typeof v === "string" && !/upgrade/i.test(v) ? v : "Unknown");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const LEAF = "assets/Leaf.png"; // placeholder when a plant has no photo

const plantsEl = $(".myplants");
const addBtn = $(".sprout-btn");
let garden = [], lastResults = [], currentPlant = null, logId = null;

// Remove the static sample card from the HTML (cards are drawn from the database now)
plantsEl.querySelectorAll(":scope > .flip-card").forEach((el) => el.remove());

// ---------- Popups (built here so garden.html stays clean) ----------
document.body.insertAdjacentHTML("beforeend", `
<div id="gd-toast" class="gd-toast" role="status"></div>

<dialog id="add-dialog" class="gd-dialog">
  <div class="gd-head"><h2>Add a plant</h2><button class="gd-btn ghost" data-close>Close</button></div>
  <div id="add-search">
    <form id="add-form" class="gd-row">
      <input id="add-q" class="gd-input" type="search" placeholder="Search a plant, e.g. monstera" autocomplete="off">
      <select id="add-light" class="gd-input gd-select" aria-label="Filter by light">
        <option value="">Any light</option>
        <option value="low">Low light</option>
        <option value="indirect">Indirect light</option>
        <option value="sun">Full sun</option>
        <option value="shade">Partial shade</option>
      </select>
      <button class="gd-btn">Search</button>
    </form>
    <p id="add-msg" class="gd-msg"></p>
    <div id="add-results" class="gd-grid"></div>
  </div>
  <div id="add-details" hidden></div>
</dialog>

<dialog id="log-dialog" class="gd-dialog">
  <div class="gd-head"><h2 id="log-title"></h2><button class="gd-btn ghost" data-close>Close</button></div>
  <div id="log-chart"></div>
  <p id="log-latest" class="gd-msg"></p>
  <form id="log-form" class="gd-row">
    <input id="log-height" class="gd-input" type="number" step="0.1" min="0" placeholder="Height (cm)" required>
    <button class="gd-btn">Log height</button>
  </form>
  <p id="log-msg" class="gd-msg"></p>
</dialog>`);

document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-close]");
  if (c) c.closest("dialog").close();
});

let toastTimer;
function toast(text) {
  const t = $("#gd-toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

// ---------- Plant cards ----------
const waterText = (g) => {
  const left = DB.daysLeft(g);
  if (left > 0) return `Water in ${plural(left, "day")}`;
  if (left === 0) return "Needs water today";
  return `Needs water (${plural(-left, "day")} late)`;
};

const TRASH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f5f5f5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

function plantCard(g) {
  const id = esc(g.id);
  const added = new Date(g.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `
  <div class="plant ${DB.daysLeft(g) <= 0 ? "due" : ""}" data-plant="${id}">
    <div class="flip-card">
      <div class="flip-card-inner">
        <div class="flip-card-front">
          ${g.image_url
            ? `<img class="plant-photo" src="${esc(g.image_url)}" alt="${esc(g.name)}">`
            : `<img class="plant-leaf" src="${LEAF}" alt="">`}
        </div>
        <div class="flip-card-back">
          <p class="title">Plant Infos</p>
          <p class="plant-info"><b>Sunlight</b>${esc(g.sunlight)}</p>
          <p class="plant-info"><b>Watering</b>Every ${plural(g.water_every_days, "day")}</p>
          <p class="plant-info"><b>Added</b>${esc(added)}</p>
          <button class="gd-btn" data-act="log" data-id="${id}">Growth log</button>
        </div>
      </div>
    </div>
    <div class="deleteplant">
      <p class="plant-name">${esc(g.name)}</p>
      <p class="water-status">${esc(waterText(g))}</p>
      <button class="gd-btn" data-act="water" data-id="${id}">Watered today</button>
      <button class="btn" data-act="delete" data-id="${id}">
        <span class="icon">${TRASH}</span>
        <span class="text">DELETE</span>
      </button>
    </div>
  </div>`;
}

// The Add button is always first; newest plant right after it, oldest last (a full row wraps down)
function renderGarden() {
  plantsEl.querySelectorAll(".plant").forEach((el) => el.remove());
  const newestFirst = [...garden].sort((a, b) => b.created_at.localeCompare(a.created_at));
  addBtn.insertAdjacentHTML("afterend", newestFirst.map(plantCard).join(""));
  fillPhotos();
}

// Update just the water text + glow of one card (no full redraw, so a flipped card stays flipped)
function updateStatus(g) {
  const el = $(`[data-plant="${g.id}"]`, plantsEl);
  if (!el) return;
  el.classList.toggle("due", DB.daysLeft(g) <= 0);
  $(".water-status", el).textContent = waterText(g);
}
setInterval(() => garden.forEach(updateStatus), 60 * 60 * 1000); // refresh if the page stays open past midnight

// Plants saved without a photo: try Wikipedia again (local plants only, we know their scientific name)
async function fillPhotos() {
  let local = [];
  try { local = await Api.local(); } catch {}
  for (const g of garden.filter((x) => !x.image_url)) {
    const sci = local.find((p) => p.id === g.perenual_id)?.scientific_name?.[0];
    if (!sci) continue;
    Api.wiki(sci).then((w) => {
      const img = $(`[data-plant="${g.id}"] .plant-leaf`, plantsEl);
      if (w.thumbnail?.source && img) { img.src = w.thumbnail.source; img.className = "plant-photo"; }
    }).catch(() => {});
  }
}

async function loadGarden() {
  try { garden = await DB.gardenList(); }
  catch (err) { toast("Could not load your garden: " + err.message); return; }
  renderGarden();
}

plantsEl.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) {
    // Touch screens have no hover: tapping a card flips it (see the hover: none rule in style.css)
    const card = e.target.closest(".flip-card");
    if (card) card.classList.toggle("flipped");
    return;
  }
  const g = garden.find((x) => x.id === b.dataset.id);
  if (!g) return;
  try {
    if (b.dataset.act === "log") openLog(g);
    if (b.dataset.act === "water") {
      await DB.markWatered(g.id);
      g.last_watered = DB.today();
      updateStatus(g);
    }
    if (b.dataset.act === "delete" && confirm("Remove this plant from your garden?")) {
      await DB.removePlant(g.id);
      garden = garden.filter((x) => x.id !== g.id);
      renderGarden();
      toast("Plant removed");
    }
  } catch (err) { toast(err.message); }
});

// ---------- Growth log popup ----------
function growthChart(logs) {
  if (!logs.length) return '<p class="gd-msg">No heights logged yet. Add the first one below.</p>';
  const W = 400, H = 190, L = 56, R = 16, T = 16, B = 32;
  const hs = logs.map((l) => Number(l.height_cm));
  const min = Math.min(...hs), max = Math.max(...hs), span = max - min || 1;
  const x = (i) => logs.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (logs.length - 1);
  const y = (h) => min === max ? (H - B + T) / 2 : H - B - ((h - min) / span) * (H - B - T);
  const pts = hs.map((h, i) => `${x(i)},${y(h)}`).join(" ");
  const dots = logs.map((l, i) => `<circle cx="${x(i)}" cy="${y(hs[i])}" r="5" fill="#e5cb91"><title>${esc(l.logged_on)}: ${esc(l.height_cm)} cm</title></circle>`).join("");
  const txt = 'fill="#c9dabe" font-size="12"';
  return `<svg class="gd-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Plant height over time">
    <polyline points="${pts}" fill="none" stroke="#e5cb91" stroke-width="3" stroke-linejoin="round"/>${dots}
    <text x="4" y="${y(max) + 4}" ${txt}>${max} cm</text>
    ${min !== max ? `<text x="4" y="${y(min) + 4}" ${txt}>${min} cm</text>` : ""}
    <text x="${L}" y="${H - 8}" ${txt}>${esc(logs[0].logged_on)}</text>
    <text x="${W - R}" y="${H - 8}" ${txt} text-anchor="end">${esc(logs.at(-1).logged_on)}</text>
  </svg>`;
}

function renderLog(g) {
  const logs = [...(g.growth_logs || [])].sort((a, b) => a.logged_on.localeCompare(b.logged_on));
  $("#log-chart").innerHTML = growthChart(logs);
  const last = logs.at(-1);
  $("#log-latest").textContent = last ? `Latest height: ${last.height_cm} cm (${plural(logs.length, "log")})` : "";
}

function openLog(g) {
  logId = g.id;
  $("#log-title").textContent = "Growth: " + g.name;
  $("#log-msg").textContent = "";
  $("#log-form").reset();
  renderLog(g);
  $("#log-dialog").showModal();
}

$("#log-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const g = garden.find((x) => x.id === logId);
  if (!g) return;
  const height = Number($("#log-height").value);
  e.submitter.disabled = true;
  try {
    await DB.addLog(g.id, height);
    (g.growth_logs ||= []).push({ height_cm: height, logged_on: DB.today() });
    renderLog(g);
    e.target.reset();
    $("#log-msg").textContent = "Logged!";
  } catch (err) { $("#log-msg").textContent = err.message; }
  finally { e.submitter.disabled = false; }
});

// ---------- Add Plants popup: search, details, add ----------
const addMsg = (t) => { $("#add-msg").textContent = t; };
const showPanel = (name) => { $("#add-search").hidden = name !== "search"; $("#add-details").hidden = name !== "details"; };

const LIGHT_TERMS = { low: ["low"], indirect: ["indirect"], sun: ["full sun"], shade: ["partial shade", "part shade", "part sun"] };
const matchesLight = (p, key) => LIGHT_TERMS[key].some((t) => clean(p.sunlight).toLowerCase().includes(t));

addBtn.addEventListener("click", () => {
  $("#add-dialog").showModal();
  showPanel("search");
  if (!$("#add-results").children.length) showRecommended();
});

async function runSearch() {
  const q = $("#add-q").value.trim(), light = $("#add-light").value;
  if (!q && !light) return showRecommended();
  addMsg("Searching...");
  try {
    let list = q ? await Api.search(q) : await Api.local(); // filter only: browse our whole list
    if (light) list = list.filter((p) => matchesLight(p, light));
    showResults(list);
    addMsg(list.length ? plural(list.length, "plant") : "No plants found. Try another name or light level.");
  } catch (err) { addMsg("Could not load plants: " + err.message); }
}
$("#add-form").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
$("#add-light").addEventListener("change", runSearch);
$("#add-q").addEventListener("input", () => { if (!$("#add-q").value.trim()) runSearch(); }); // empty box -> recommendations

// Random picks from our local list (instant, no API call)
async function showRecommended() {
  try {
    const picks = [...(await Api.local())].sort(() => Math.random() - 0.5).slice(0, 8);
    showResults(picks);
    addMsg("Recommended plants");
  } catch (err) { addMsg("Could not load plants: " + err.message); }
}

function showResults(list) {
  lastResults = list;
  $("#add-results").innerHTML = list.map((p) => {
    const img = p.default_image?.thumbnail;
    return `
    <div class="gd-card" data-card="${esc(p.id)}">
      <img src="${esc(img || LEAF)}" alt="" class="${img ? "" : "ph"}">
      <h3>${esc(p.common_name || p.scientific_name?.[0])}</h3>
      <p class="sci">${esc(p.scientific_name?.[0])}</p>
      <button class="gd-btn" data-view="${esc(p.id)}">View details</button>
    </div>`;
  }).join("");
  fillImages(list);
}

// Local plants have no photos: load each from Wikipedia (cached in localStorage by api.js)
function fillImages(list) {
  for (const p of list.filter((x) => x.local)) {
    Api.wiki(p.scientific_name[0]).then((w) => {
      const img = $(`[data-card="${p.id}"] img`, $("#add-results"));
      if (w.thumbnail?.source && img) { img.src = w.thumbnail.source; img.classList.remove("ph"); }
    }).catch(() => {});
  }
}

$("#add-results").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) openPlant(b.dataset.view);
});

async function openPlant(id) {
  const box = $("#add-details");
  showPanel("details");
  box.innerHTML = '<p class="gd-msg">Loading...</p>';
  try {
    const item = lastResults.find((x) => String(x.id) === String(id));
    let p = item, notice = "";
    if (!item?.local) {
      try { p = await Api.details(id); }
      catch (err) {
        // 429 etc: fall back to the data we already have from the search list
        if (!item) throw err;
        notice = "Plant API limit reached: showing basic info.";
      }
    }
    const title = p.local ? p.scientific_name[0] : (p.common_name || p.scientific_name?.[0]);
    const [wiki] = await Promise.allSettled([title ? Api.wiki(title) : Promise.reject(new Error("no title"))]);
    const w = wiki.status === "fulfilled" ? wiki.value : null;
    currentPlant = { ...p, wikiImage: w?.thumbnail?.source };
    const photo = p.default_image?.regular_url ?? w?.thumbnail?.source;
    const desc = w?.extract || (typeof p.description === "string" && !/upgrade/i.test(p.description) ? p.description : "No description available.");
    box.innerHTML = `
      ${photo ? `<img class="gd-photo" src="${esc(photo)}" alt="">` : ""}
      <h3 class="gd-name">${esc(p.common_name || p.scientific_name?.[0])}</h3>
      <p class="sci">${esc(p.scientific_name?.[0])}</p>
      <p><b>Sunlight:</b> ${esc(clean(p.sunlight))}<br><b>Watering:</b> ${esc(clean(p.watering))}${p.water_every_days ? ` (about every ${p.water_every_days} days)` : ""}</p>
      <p>${esc(desc)}</p>
      ${w?.content_urls ? `<p><a href="${esc(w.content_urls.desktop.page)}" target="_blank" rel="noopener">Read more on Wikipedia</a></p>` : ""}
      <p id="details-msg" class="gd-msg">${esc(notice)}</p>
      <div class="gd-row">
        <button class="gd-btn ghost" data-back>Back to results</button>
        <button class="gd-btn" data-add>Add to my garden</button>
      </div>`;
  } catch (err) {
    box.innerHTML = `<p class="gd-msg">Could not load details: ${esc(err.message)}</p><button class="gd-btn ghost" data-back>Back to results</button>`;
  }
}

$("#add-details").addEventListener("click", async (e) => {
  if (e.target.closest("[data-back]")) return showPanel("search");
  const b = e.target.closest("[data-add]");
  if (!b || !currentPlant) return;
  b.disabled = true;
  try {
    await DB.addPlant({
      perenual_id: currentPlant.id,
      name: currentPlant.common_name || currentPlant.scientific_name?.[0] || "Unnamed plant",
      image_url: currentPlant.default_image?.thumbnail ?? currentPlant.wikiImage ?? null,
      sunlight: clean(currentPlant.sunlight),
      water_every_days: currentPlant.water_every_days ?? Api.waterDays(currentPlant.watering),
    });
    $("#add-dialog").close();
    toast("Added to your garden");
    await loadGarden();
  } catch (err) {
    b.disabled = false;
    $("#details-msg").textContent = err.message;
  }
});

// ---------- Start ----------
loadGarden();