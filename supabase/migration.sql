-- TableSplit Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Tables
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  name text default 'My Table',
  created_at timestamptz default now()
);

-- Participants
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id) on delete cascade,
  name text not null,
  amount numeric default 0,
  created_at timestamptz default now()
);

-- Index for faster lookups
create index if not exists idx_participants_table_id on participants(table_id);

-- Enable Row Level Security (allow all for now — no auth)
alter table tables enable row level security;
alter table participants enable row level security;

-- Policies: allow full access (public app, no auth)
create policy "Allow all on tables" on tables for all using (true) with check (true);
create policy "Allow all on participants" on participants for all using (true) with check (true);

-- Enable Realtime for participants table
alter publication supabase_realtime add table participants;

-- Trips (multi-expense tracker; each expense has a payer and amount)
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text default 'My Trip',
  created_at timestamptz default now()
);

create table if not exists trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  participant_id uuid not null references trip_participants(id) on delete cascade,
  description text default '',
  amount numeric not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_trip_participants_trip_id on trip_participants(trip_id);
create index if not exists idx_trip_expenses_trip_id on trip_expenses(trip_id);
create index if not exists idx_trip_expenses_participant_id on trip_expenses(participant_id);

alter table trips enable row level security;
alter table trip_participants enable row level security;
alter table trip_expenses enable row level security;

create policy "Allow all on trips" on trips for all using (true) with check (true);
create policy "Allow all on trip_participants" on trip_participants for all using (true) with check (true);
create policy "Allow all on trip_expenses" on trip_expenses for all using (true) with check (true);

alter publication supabase_realtime add table trip_participants;
alter publication supabase_realtime add table trip_expenses;
