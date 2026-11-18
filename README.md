# Leafwise (working title)
Plant wiki + personal garden. Track: **JavaScript (web)**. Plain HTML/CSS/JS, no build step.

## Run
1. Create a free Supabase project, then run `supabase/schema.sql` in the SQL Editor.
2. Supabase > Authentication > Providers > Email: turn OFF "Confirm email" (required: usernames use fake emails).
3. Get a free key at perenual.com/docs/api.
4. Copy `js/config.example.js` to `js/config.js` and fill it in (Supabase URL + key; Perenual key is optional, only used when a plant isn't in `data/plants.json`). `config.js` is git-ignored, so your keys stay private.
5. Run `npx serve` and open http://localhost:3000 — `/app` is Explore, `/garden` is My garden. (or use VS Code "Live Server").

## Pages
- `index.html`: landing page
- `app.html`: Explore + My garden
- `login.html`: login / create account

## Files
- `js/login.js`: login page logic
- `js/nav.js`: landing page header (shows the login state)
- `js/theme.js`: light/dark toggle (saved in localStorage; follows the system setting by default)
- `data/plants.json`: our own plant list (searched first; Perenual is the fallback)
- `js/api.js`: plant search, Wikipedia fetch, localStorage cache
- `js/db.js`: Supabase auth and garden queries (SQL)
- `js/app.js`: DOM rendering, event listeners, reminders, URL routing
- `serve.json`: clean-URL rewrite (`/garden` → `app.html`)
- `supabase/schema.sql`: tables and Row Level Security

## Requirement checklist
- DOM + events: `app.js` (submit, click delegation, dialogs, interval)
- localStorage + SQL database: cache, reminder flag, and theme / Supabase tables
- Async API fetch: `api.js`
