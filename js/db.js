// Supabase (Postgres): auth + per-user garden. Row Level Security (see supabase/schema.sql)
// makes sure each user can only touch their own rows.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Supabase Auth needs an email, so a username becomes "username@AUTH_DOMAIN" behind the scenes.
const toEmail = (username) => username.trim().toLowerCase() + "@" + CONFIG.AUTH_DOMAIN;

const DB = {
  // The username as typed (with its capitals) is also kept in the account, so the app can show it exactly as entered.
  signUp: (username, password) => sb.auth.signUp({ email: toEmail(username), password, options: { data: { username: username.trim() } } }),
  signIn: (username, password) => sb.auth.signInWithPassword({ email: toEmail(username), password }),
  signOut: () => sb.auth.signOut(),

  // Dates are YYYY-MM-DD in the user's LOCAL time (not UTC), so "today" matches the clock on their device.
  today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  // Whole local days since a "YYYY-MM-DD" date. (new Date("YYYY-MM-DD") would mean UTC midnight, so build it from its parts.)
  daysSince(date) {
    const [y, m, d] = date.split("-").map(Number), now = new Date();
    return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 864e5);
  },
  // Days until the plant needs water: 0 = today, negative = overdue.
  daysLeft: (g) => g.water_every_days - DB.daysSince(g.last_watered),
  // The same plant can be added more than once, so suggest "Monstera 2", "Monstera 3"... to tell the cards apart.
  nextName(base, taken = []) {
    const used = new Set(taken.map((n) => n.toLowerCase()));
    let name = base, i = 1;
    while (used.has(name.toLowerCase())) name = base + " " + ++i;
    return name;
  },

  async must(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },
  gardenList: () => DB.must(sb.from("garden_plants").select("*, growth_logs(*)").order("created_at")),
  // last_watered is sent from here (local date), so a new plant counts as watered on the user's own "today".
  addPlant: (p) => DB.must(sb.from("garden_plants").insert({ last_watered: DB.today(), ...p })),
  plantNames: async () => (await DB.must(sb.from("garden_plants").select("name"))).map((r) => r.name),
  markWatered: (id) => DB.must(sb.from("garden_plants").update({ last_watered: DB.today() }).eq("id", id)),
  saveNote: (id, note) => DB.must(sb.from("garden_plants").update({ note }).eq("id", id)),
  removePlant: (id) => DB.must(sb.from("garden_plants").delete().eq("id", id)),
  addLog(plant_id, height_cm) {
    const h = Number(height_cm);
    if (height_cm === "" || height_cm == null || !Number.isFinite(h) || h < 0 || h > 10000) throw new Error("Height must be between 0 and 10000 cm.");
    return DB.must(sb.from("growth_logs").insert({ plant_id, height_cm: h, logged_on: DB.today() }));
  },
  // How many plants need water today (for the badge in the nav)
  async dueCount() {
    const rows = await DB.must(sb.from("garden_plants").select("water_every_days, last_watered"));
    return rows.filter((g) => DB.daysLeft(g) <= 0).length;
  },
};