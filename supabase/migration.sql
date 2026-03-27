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
