-- Incident drafts table for resumable, cross-device report drafts.
--
-- Run this in the Supabase SQL editor (or via the CLI) for the project pointed
-- at by VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
--
-- One row per incident number (upsert on conflict). The payload stores all
-- cross-device JSON state for a report: the filled fields plus the editable
-- annex data (floorplan, Annex E markers, Annex G strokes/fields). Photos are
-- NOT stored here; they persist locally on the device in IndexedDB.

create table if not exists public.incident_drafts (
  incident_no text primary key,
  location_of_fire text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incident_drafts_updated_at_idx
  on public.incident_drafts (updated_at desc);

-- Keep updated_at fresh on every update.
create or replace function public.set_incident_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists incident_drafts_set_updated_at on public.incident_drafts;
create trigger incident_drafts_set_updated_at
  before update on public.incident_drafts
  for each row
  execute function public.set_incident_drafts_updated_at();

-- Row Level Security.
--
-- The web app authenticates with the Supabase ANON key only (no user auth), so
-- the anon role must be allowed to read/write drafts. This means anyone holding
-- the anon key can access all drafts. That matches the app's current trust model
-- (internal tool). Tighten these policies if/when real auth is introduced.
alter table public.incident_drafts enable row level security;

drop policy if exists "incident_drafts anon read" on public.incident_drafts;
create policy "incident_drafts anon read"
  on public.incident_drafts
  for select
  to anon
  using (true);

drop policy if exists "incident_drafts anon insert" on public.incident_drafts;
create policy "incident_drafts anon insert"
  on public.incident_drafts
  for insert
  to anon
  with check (true);

drop policy if exists "incident_drafts anon update" on public.incident_drafts;
create policy "incident_drafts anon update"
  on public.incident_drafts
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "incident_drafts anon delete" on public.incident_drafts;
create policy "incident_drafts anon delete"
  on public.incident_drafts
  for delete
  to anon
  using (true);
