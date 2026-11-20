// explore.html: browse plants (random picks, search, light filter), read the details, add to your garden.
// Load order: supabase-js, js/config.js, js/db.js, js/guard.js (in the <head>), then js/api.js and this file.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Perenual's free tier returns "Upgrade Plans..." strings for locked fields
const clean = (v) => Array.isArray(v) ? v.join(", ") : (typeof v === "string" && !/upgrade/i.test(v) ? v : "Unknown");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const LEAF = "assets/Leaf.png"; // placeholder when a plant has no photo

let lastResults = [], currentPlant = null;

let toastTimer;
function toast(text) {
  const t = $("#gd-toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}
const setMsg = (text) => { $("#explore-msg").textContent = text; };

document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-close]");
  if (c) c.closest("dialog").close();
});

// ---------- Search + filter ----------
const LIGHT_TERMS = { low: ["low"], indirect: ["indirect"], sun: ["full sun"], shade: ["partial shade", "part shade", "part sun"] };
const matchesLight = (p, key) => LIGHT_TERMS[key].some((t) => clean(p.sunlight).toLowerCase().includes(t));

// Newest search wins: a slower, older search must not overwrite the results of a newer one.
let searchId = 0;
async function runSearch() {
  const q = $("#q").value.trim(), light = $("#light-filter").value;
  const id = ++searchId;
  if (!q && !light) return showRecommended();
  setMsg("Searching...");
  try {
    let list = q ? await Api.search(q) : await Api.local(); // filter only: browse our whole list
    if (id !== searchId) return; // a newer search started while we waited
    if (light) list = list.filter((p) => matchesLight(p, light));
    showResults(list);
    setMsg(list.length ? plural(list.length, "plant") : "No plants found. Try another name or light level.");
  } catch (err) {
    if (id === searchId) setMsg("Could not load plants: " + err.message);
  }
}
$("#explore-form").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
$("#light-filter").addEventListener("change", runSearch);
$("#q").addEventListener("input", () => { if (!$("#q").value.trim()) runSearch(); }); // empty box -> recommendations

// Opens with random picks from our local list (instant, no API call)
async function showRecommended() {
  try {
    const picks = Api.shuffle(await Api.local()).slice(0, 8);
    showResults(picks);
    setMsg("Recommended plants");
  } catch (err) { setMsg("Could not load plants: " + err.message); }
}

// ---------- Cards ----------
function exploreCard(p) {
  const id = esc(p.id);
  const img = p.default_image?.thumbnail;
  const name = p.common_name || p.scientific_name?.[0];
  const water = p.water_every_days ? `Every ${plural(p.water_every_days, "day")}` : clean(p.watering);
  return `
  <div class="plant" data-card="${id}">
    <div class="flip-card">
      <div class="flip-card-inner">
        <div class="flip-card-front">
          ${img ? `<img class="plant-photo" src="${esc(img)}" alt="${esc(name)}">` : `<img class="plant-leaf" src="${LEAF}" alt="">`}
        </div>
        <div class="flip-card-back">
          <p class="title">Plant Infos</p>
          <p class="plant-info"><b>Sunlight</b>${esc(clean(p.sunlight))}</p>
          <p class="plant-info"><b>Watering</b>${esc(water)}</p>
        </div>
      </div>
    </div>
    <div class="deleteplant">
      <p class="plant-name">${esc(name)}</p>
      <p class="plant-sci">${esc(p.scientific_name?.[0])}</p>
      <button class="gd-btn" data-view="${id}">View details</button>
    </div>
  </div>`;
}

function showResults(list) {
  lastResults = list;
  $("#results").innerHTML = list.map(exploreCard).join("");
  fillImages(list);
}

// Local plants have no photos: load each from Wikipedia (cached in localStorage by api.js)
function fillImages(list) {
  for (const p of list.filter((x) => x.local)) {
    Api.wiki(p.scientific_name[0]).then((w) => {
      const img = $(`[data-card="${p.id}"] .plant-leaf`, $("#results"));
      if (w.thumbnail?.source && img) { img.src = w.thumbnail.source; img.className = "plant-photo"; }
    }).catch(() => {});
  }
}

$("#results").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) return openPlant(b.dataset.view);
  // Touch screens have no hover: tapping a card flips it (see the hover: none rule in style.css)
  const card = e.target.closest(".flip-card");
  if (card) card.classList.toggle("flipped");
});

// ---------- Details popup ----------
async function openPlant(id) {
  const box = $("#plant-body");
  box.innerHTML = '<p class="gd-msg">Loading...</p>';
  $("#plant-dialog").showModal();
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
    // Duplicates are allowed: suggest a free name ("Monstera 2") that the person can edit
    let taken = [];
    try { taken = await DB.plantNames(); } catch {}
    const suggested = DB.nextName((p.common_name || p.scientific_name?.[0] || "Unnamed plant").slice(0, 50), taken);
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
      <div class="gd-row"><input id="plant-name" class="gd-input" maxlength="60" value="${esc(suggested)}" placeholder="Name in your garden" aria-label="Name in your garden"></div>
      <div class="gd-row"><button class="gd-btn" data-add>Add to my garden</button></div>`;
  } catch (err) {
    box.innerHTML = `<p class="gd-msg">Could not load details: ${esc(err.message)}</p>`;
  }
}

$("#plant-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-add]");
  if (!b || !currentPlant) return;
  b.disabled = true;
  try {
    await DB.addPlant({
      perenual_id: currentPlant.id,
      name: ($("#plant-name")?.value.trim() || currentPlant.common_name || currentPlant.scientific_name?.[0] || "Unnamed plant").slice(0, 60),
      image_url: currentPlant.default_image?.thumbnail ?? currentPlant.wikiImage ?? null,
      sunlight: clean(currentPlant.sunlight),
      water_every_days: currentPlant.water_every_days ?? Api.waterDays(currentPlant.watering),
    });
    $("#plant-dialog").close();
    toast("Added to your garden");
  } catch (err) {
    b.disabled = false;
    $("#details-msg").textContent = err.message;
  }
});

// ---------- Start ----------
showRecommended();