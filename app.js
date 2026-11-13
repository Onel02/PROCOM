const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const els = {
  form: $('search-form'), input: $('search-input'), status: $('status'),
  results: $('results'), favorites: $('favorites'), recent: $('recent'), player: $('player'),
};

const LS_DEVICE = 'deviceId';
const LS_RECENT = 'recentSearches';
const deviceId = getDeviceId();

let results = new Map();    // trackId -> track (last search)
let favorites = new Map();  // trackId -> track (from Supabase)

// ---------- localStorage ----------
function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(LS_DEVICE, id); }
  return id;
}
const getRecent = () => JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
function addRecent(term) {
  const list = [term, ...getRecent().filter((t) => t !== term)].slice(0, 5);
  localStorage.setItem(LS_RECENT, JSON.stringify(list));
  renderRecent();
}

// ---------- Public API (iTunes Search, no key needed) ----------
async function searchTracks(term) {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=12&term=${encodeURIComponent(term)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.results.map((r) => ({
    id: r.trackId, name: r.trackName, artist: r.artistName,
    art: r.artworkUrl100, preview: r.previewUrl,
  }));
}

// ---------- Supabase ----------
async function loadFavorites() {
  const { data, error } = await db.from('favorites').select('*')
    .eq('device_id', deviceId).order('created_at', { ascending: false });
  if (error) return setStatus(`Could not load favorites: ${error.message}`);
  favorites = new Map(data.map((r) => [r.track_id, {
    id: r.track_id, name: r.track_name, artist: r.artist_name,
    art: r.artwork_url, preview: r.preview_url,
  }]));
  renderAll();
}

async function addFavorite(track) {
  const { error } = await db.from('favorites').insert({
    device_id: deviceId, track_id: track.id, track_name: track.name,
    artist_name: track.artist, artwork_url: track.art, preview_url: track.preview,
  });
  if (error) return setStatus(`Could not save: ${error.message}`);
  favorites.set(track.id, track);
  renderAll();
}

async function removeFavorite(id) {
  const { error } = await db.from('favorites').delete()
    .eq('device_id', deviceId).eq('track_id', id);
  if (error) return setStatus(`Could not remove: ${error.message}`);
  favorites.delete(id);
  renderAll();
}

// ---------- Rendering (DOM manipulation) ----------
function setStatus(msg) { els.status.textContent = msg; }

function trackItem(t, actionLabel, action, disabled = false) {
  const li = document.createElement('li');
  li.className = 'track';
  li.dataset.id = t.id;

  const img = document.createElement('img');
  img.src = t.art; img.alt = '';

  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('div');
  name.className = 'name'; name.textContent = t.name;
  const artist = document.createElement('div');
  artist.className = 'artist'; artist.textContent = t.artist;
  info.append(name, artist);

  const play = document.createElement('button');
  play.dataset.action = 'play'; play.textContent = 'Play';

  const act = document.createElement('button');
  act.dataset.action = action; act.textContent = actionLabel; act.disabled = disabled;

  li.append(img, info, play, act);
  return li;
}

function renderResults() {
  els.results.replaceChildren(...[...results.values()].map((t) =>
    favorites.has(t.id)
      ? trackItem(t, 'Saved', 'none', true)
      : trackItem(t, 'Favorite', 'favorite')));
}

function renderFavorites() {
  els.favorites.replaceChildren(...[...favorites.values()].map((t) =>
    trackItem(t, 'Remove', 'remove')));
  if (!favorites.size) setStatus('');
}

function renderRecent() {
  els.recent.replaceChildren(...getRecent().map((term) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = term; b.dataset.term = term;
    return b;
  }));
}

function renderAll() { renderResults(); renderFavorites(); }

// ---------- Event listeners ----------
async function runSearch(term) {
  setStatus('Searching...');
  try {
    const tracks = await searchTracks(term);
    results = new Map(tracks.map((t) => [t.id, t]));
    addRecent(term);
    renderResults();
    setStatus(tracks.length ? '' : 'No songs found. Try another search.');
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const term = els.input.value.trim();
  if (term) runSearch(term);
});

els.recent.addEventListener('click', (e) => {
  const term = e.target.dataset.term;
  if (term) { els.input.value = term; runSearch(term); }
});

function handleListClick(source) {
  return (e) => {
    const btn = e.target.closest('button');
    const li = e.target.closest('li');
    if (!btn || !li) return;
    const id = Number(li.dataset.id);
    const track = source().get(id);
    if (btn.dataset.action === 'play' && track.preview) {
      els.player.src = track.preview; els.player.play();
    } else if (btn.dataset.action === 'favorite') addFavorite(track);
    else if (btn.dataset.action === 'remove') removeFavorite(id);
  };
}
els.results.addEventListener('click', handleListClick(() => results));
els.favorites.addEventListener('click', handleListClick(() => favorites));

// ---------- Init ----------
renderRecent();
loadFavorites();
