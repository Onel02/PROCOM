# Leafwise
A plant wiki and personal garden tracker. Search plants, learn how much sun and water they need, add them to your own garden, get watering reminders and log how tall they grow.

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
1. Create a free Supabase project, then run `supabase/schema.sql` in the SQL Editor.
2. Supabase > Authentication > Providers > Email: turn OFF "Confirm email" (required, usernames use fake emails behind the scenes).
3. Get a free key at perenual.com/docs/api (optional, it is only used when a plant is not in `data/plants.json`).
4. Copy `js/config.example.js` to `js/config.js` and fill in your Supabase URL, anon key and Perenual key. `config.js` is git-ignored, so your keys stay private.
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
- `data/plants.json`: our own plant list (searched first; Perenual is the fallback)
- `supabase/schema.sql`: database tables and Row Level Security
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
- Watering dates are counted in UTC, like the database's `current_date`.

## Credits
Plant descriptions and photos from Wikipedia (CC BY-SA). Extra plant data from Perenual.