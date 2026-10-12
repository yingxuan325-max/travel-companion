-- Travel Companion: shared state table
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- WARNING: this starter setup allows anonymous read/write to this one shared trip row.
-- Anyone who knows the public project URL/key can potentially read or change trip data.
-- Do not store sensitive personal information. See README before using publicly.

create table if not exists public.trip_shared_state (
  trip_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.trip_shared_state enable row level security;

drop policy if exists "Public can read shared trip" on public.trip_shared_state;
create policy "Public can read shared trip"
on public.trip_shared_state
for select
to anon, authenticated
using (true);

drop policy if exists "Public can insert shared trip" on public.trip_shared_state;
create policy "Public can insert shared trip"
on public.trip_shared_state
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can update shared trip" on public.trip_shared_state;
create policy "Public can update shared trip"
on public.trip_shared_state
for update
to anon, authenticated
using (true)
with check (true);

grant select, insert, update on public.trip_shared_state to anon, authenticated;

-- Enable Realtime updates so changes made on one device appear on other open devices.
do $$
begin
  alter publication supabase_realtime add table public.trip_shared_state;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime not found. Enable Realtime for trip_shared_state in the Supabase Dashboard.';
end $$;
