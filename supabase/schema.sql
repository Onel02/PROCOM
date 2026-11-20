-- Run in Supabase > SQL Editor. Passwords are handled by Supabase Auth (auth.users), not stored by us.
create table garden_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  perenual_id int not null,
  name text not null check (char_length(name) between 1 and 60),
  image_url text,
  sunlight text,
  note text,
  water_every_days int not null default 7 check (water_every_days > 0),
  last_watered date not null default current_date,
  created_at timestamptz not null default now()
);

create table growth_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references garden_plants on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  height_cm numeric not null check (height_cm >= 0 and height_cm <= 10000),
  logged_on date not null default current_date
);

alter table garden_plants enable row level security;
alter table growth_logs enable row level security;

create policy "own plants" on garden_plants for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- A log may only be attached to one of YOUR plants (foreign keys alone skip row level security)
create policy "own logs" on growth_logs for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from garden_plants p where p.id = growth_logs.plant_id and p.user_id = auth.uid())
  );