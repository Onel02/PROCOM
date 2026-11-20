// Supabase (Postgres): auth + per-user garden. Row Level Security (see supabase/schema.sql)
// makes sure each user can only touch their own rows.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Supabase Auth needs an email, so a username becomes "username@AUTH_DOMAIN" behind the scenes.
const toEmail = (username) => username.trim().toLowerCase() + "@" + CONFIG.AUTH_DOMAIN;

const DB = {
  signUp: (username, password) => sb.auth.signUp({ email: toEmail(username), password }),
  signIn: (username, password) => sb.auth.signInWithPassword({ email: toEmail(username), password }),
  signOut: () => sb.auth.signOut(),

  // Same date maths as the original app: dates are YYYY-MM-DD and counted in UTC (like the database's current_date).
  today: () => new Date().toISOString().slice(0, 10),
  // Days until the plant needs water: 0 = today, negative = overdue.
  daysLeft: (g) => g.water_every_days - Math.floor((Date.now() - new Date(g.last_watered)) / 864e5),

  async must(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },
  gardenList: () => DB.must(sb.from("garden_plants").select("*, growth_logs(*)").order("created_at")),
  addPlant: (p) => DB.must(sb.from("garden_plants").insert(p)),
  markWatered: (id) => DB.must(sb.from("garden_plants").update({ last_watered: DB.today() }).eq("id", id)),
  saveNote: (id, note) => DB.must(sb.from("garden_plants").update({ note }).eq("id", id)),
  removePlant: (id) => DB.must(sb.from("garden_plants").delete().eq("id", id)),
  addLog: (plant_id, height_cm) => DB.must(sb.from("growth_logs").insert({ plant_id, height_cm })),
  // How many plants need water today (for the badge in the nav)
  async dueCount() {
    const rows = await DB.must(sb.from("garden_plants").select("water_every_days, last_watered"));
    return rows.filter((g) => DB.daysLeft(g) <= 0).length;
  },
};