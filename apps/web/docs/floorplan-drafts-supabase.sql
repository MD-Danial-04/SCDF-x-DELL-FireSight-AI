-- Floorplan drafts table for the Annex A floorplan editor.
--
-- Run this in the Supabase SQL editor (or via the CLI) for the project pointed
-- at by VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
--
-- Drafts are scoped per incident number and store the full serializable editor
-- state (base SVG + amendments + generated elements + groups) as JSONB.

create table if not exists public.floorplan_drafts (
  id uuid primary key default gen_random_uuid(),
  incident_no text not null,
  name text not null,
  payload jsonb not null,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floorplan_drafts_incident_no_idx
  on public.floorplan_drafts (incident_no);

-- Keep updated_at fresh on every update.
create or replace function public.set_floorplan_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists floorplan_drafts_set_updated_at on public.floorplan_drafts;
create trigger floorplan_drafts_set_updated_at
  before update on public.floorplan_drafts
  for each row
  execute function public.set_floorplan_drafts_updated_at();

-- Row Level Security.
--
-- The web app authenticates with the Supabase ANON key only (no user auth), so
-- the anon role must be allowed to read/write drafts. This means anyone holding
-- the anon key can access all drafts. That matches the app's current trust model
-- (internal tool). Tighten these policies if/when real auth is introduced.
alter table public.floorplan_drafts enable row level security;

drop policy if exists "floorplan_drafts anon read" on public.floorplan_drafts;
create policy "floorplan_drafts anon read"
  on public.floorplan_drafts
  for select
  to anon
  using (true);

drop policy if exists "floorplan_drafts anon insert" on public.floorplan_drafts;
create policy "floorplan_drafts anon insert"
  on public.floorplan_drafts
  for insert
  to anon
  with check (true);

drop policy if exists "floorplan_drafts anon update" on public.floorplan_drafts;
create policy "floorplan_drafts anon update"
  on public.floorplan_drafts
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "floorplan_drafts anon delete" on public.floorplan_drafts;
create policy "floorplan_drafts anon delete"
  on public.floorplan_drafts
  for delete
  to anon
  using (true);
