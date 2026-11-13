-- Run in Supabase > SQL Editor
create table favorites (
  id          bigint generated always as identity primary key,
  device_id   text   not null,   -- random id kept in localStorage (no login yet)
  track_id    bigint not null,   -- iTunes trackId
  track_name  text,
  artist_name text,
  artwork_url text,
  preview_url text,
  created_at  timestamptz default now(),
  unique (device_id, track_id)
);

alter table favorites enable row level security;

-- Skeleton only: open access for the anon key. Tighten once auth is added.
create policy "anon read"   on favorites for select using (true);
create policy "anon insert" on favorites for insert with check (true);
create policy "anon delete" on favorites for delete using (true);
