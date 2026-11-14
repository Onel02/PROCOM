// Supabase (Postgres): auth + per-user garden. Row Level Security (see supabase/schema.sql)
// makes sure each user can only touch their own rows.
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const DB = {
  signUp: (email, password) => sb.auth.signUp({ email, password }),
  signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
  signOut: () => sb.auth.signOut(),

  async must(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },
  gardenList: () => DB.must(sb.from("garden_plants").select("*, growth_logs(*)").order("created_at")),
  addPlant: (p) => DB.must(sb.from("garden_plants").insert(p)),
  markWatered: (id) => DB.must(sb.from("garden_plants").update({ last_watered: new Date().toISOString().slice(0, 10) }).eq("id", id)),
  removePlant: (id) => DB.must(sb.from("garden_plants").delete().eq("id", id)),
  addLog: (plant_id, height_cm) => DB.must(sb.from("growth_logs").insert({ plant_id, height_cm })),
};
