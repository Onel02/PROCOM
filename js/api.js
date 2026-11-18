// External data: Perenual (plant data) + Wikipedia (extra info). All async fetch().
// Results are cached in localStorage so we stay under Perenual's free daily limit.
const Api = {
  async cached(key, ttlMs, fetcher) {
    try {
      const c = JSON.parse(localStorage.getItem(key));
      if (c && Date.now() - c.t < ttlMs) return c.v;
    } catch {}
    const v = await fetcher();
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch {}
    return v;
  },

  async getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
    return r.json();
  },

  async local() { return (this.localList ??= await this.getJson("data/plants.json")); },

  // Our own list first (data/plants.json); Perenual only when nothing matches.
  async search(q) {
    const term = q.toLowerCase();
    const hits = (await this.local()).filter((p) => (p.common_name + " " + p.scientific_name[0]).toLowerCase().includes(term));
    return hits.length ? hits : this.searchPerenual(q);
  },

  searchPerenual(q) {
    return this.cached("search:" + q.toLowerCase(), 7 * 864e5, async () =>
      (await this.getJson(`https://perenual.com/api/v2/species-list?key=${CONFIG.PERENUAL_KEY}&q=${encodeURIComponent(q)}`)).data);
  },

  details(id) {
    return this.cached("plant:" + id, 7 * 864e5, () =>
      this.getJson(`https://perenual.com/api/v2/species/details/${id}?key=${CONFIG.PERENUAL_KEY}`));
  },

  wiki(title) {
    return this.cached("wiki:" + title.toLowerCase(), 30 * 864e5, () =>
      this.getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`));
  },

  // Perenual's "watering" label -> days between watering (our own mapping, adjust freely)
  waterDays(label) {
    return { frequent: 3, average: 7, minimum: 14 }[String(label).toLowerCase()] ?? 7;
  },
};