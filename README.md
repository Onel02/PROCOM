# Leafwise (working title)
Plant wiki + personal garden. Track: **JavaScript (web)**. Plain HTML/CSS/JS, no build step.

## Run
1. Create a free Supabase project, then run `supabase/schema.sql` in the SQL Editor.
2. (Dev only) Supabase > Authentication > Providers > Email: turn off "Confirm email".
3. Get a free key at perenual.com/docs/api.
4. Fill in `js/config.js` (Perenual key, Supabase URL, anon key).
5. Open `index.html` (or use VS Code "Live Server").

## Files
- `js/api.js`: Perenual + Wikipedia fetch, localStorage cache
- `js/db.js`: Supabase auth and garden queries (SQL)
- `js/app.js`: DOM rendering, event listeners, reminders
- `supabase/schema.sql`: tables and Row Level Security

## Requirement checklist
- DOM + events: `app.js` (submit, click delegation, dialogs, interval)
- localStorage + SQL database: cache and reminder flag / Supabase tables
- Async API fetch: `api.js`
