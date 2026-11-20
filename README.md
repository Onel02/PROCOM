# Leafwise
A plant wiki and personal garden tracker. Search plants, learn how much sun and water they need, add them to your own garden, get on-screen watering reminders (no notifications) and log how tall they grow.

Track: **JavaScript (web)**. Plain HTML, CSS and JS, no build step.

Built by: [team member names]

## Features
- **Landing page** (before login): what Leafwise is, and a short guide.
- **Accounts**: sign up and log in with a username and password.
- **Explore**: random plant picks, search by name, filter by light, plant details with a Wikipedia description.
- **Personal garden**: one card per plant (photo on the front, sunlight, watering and date added on the back).
  - "Watered today" button and a watering reminder (glowing card, plus a badge in the nav).
  - Growth log with a height chart.
  - Delete a plant.

## Run
1. Create a free Supabase project, then run `supabase/schema.sql` in the SQL Editor. (Tables created earlier: run `supabase/migrate_checks.sql` once instead.)
2. Supabase > Authentication > Providers > Email: turn OFF "Confirm email" (required, usernames use fake emails behind the scenes).
3. Optional: get a free key at perenual.com/docs/api. Without it the app searches only our own `data/plants.json`; with it, Perenual is used when a plant is not in that list.
4. Copy `js/config.example.js` to `js/config.js` and fill in your Supabase URL and anon key. Leave the Perenual key as the placeholder if you have none. `config.js` is git-ignored, so your keys stay private.
5. Start a local server with `npx serve` and open `http://localhost:3000`.

## Pages
- `before_login.html`: landing page
- `login.html`: log in / sign up
- `after_login.html`: home after login
- `garden.html`: personal garden
- `explore.html`: plant search and details

## Files
- `style.css`: all styles for the pages above
- `serve.json`: makes `npx serve` open `before_login.html` first
- `assets/`: images
- `data/plants.json`: our own plant list (searched first; Perenual is an optional fallback)
- `supabase/schema.sql`: database tables and Row Level Security
- `supabase/migrate_checks.sql`: one-time update for tables created with the older schema (value checks, stricter log policy)
- `js/config.example.js`: template for `config.js` (keys)
- `js/db.js`: Supabase auth and garden queries
- `js/api.js`: plant search, Wikipedia fetch, localStorage cache
- `js/auth.js`: log in / sign up form
- `js/guard.js`: sends visitors who are not logged in to the login page
- `js/session.js`: username, user menu and watering badge on `after_login.html`
- `js/garden.js`: garden cards, add-plant popup, growth log
- `js/explore.js`: explore page

## Requirement checklist
- **DOM + events**: `garden.js`, `explore.js`, `auth.js`, `session.js` (form submits, click delegation, dialogs, card flips, timers)
- **localStorage**: `api.js` caches search results, plant details and Wikipedia summaries
- **SQL database**: Supabase tables in `schema.sql`, used through `db.js`
- **Async API fetch**: `api.js` (Perenual and Wikipedia), `db.js` (Supabase)

## Notes
- Usernames are 3-20 letters, numbers or `_`. Behind the scenes a username becomes `username@AUTH_DOMAIN` because Supabase Auth needs an email.
- Each user can only read and write their own rows (Row Level Security).
- Watering and growth-log dates use your device's local time. The app sends the date itself, so the database's UTC `current_date` is never used.
- Plants can be added more than once. The name box in the details popup suggests "Monstera 2", "Monstera 3"... and can be edited.

## Credits
Plant descriptions and photos from Wikipedia (CC BY-SA). Extra plant data from Perenual.