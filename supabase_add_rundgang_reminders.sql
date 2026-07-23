-- ============================================================================
-- Merker-Tabelle für die Rundgang-Erinnerungen (fällig / läuft ab / verpasst).
-- Verhindert, dass dieselbe Erinnerung mehrfach rausgeht. Wird nur von der
-- geplanten Funktion "checkin-reminders" beschrieben.
-- ============================================================================
create table if not exists checkin_erinnerungen (
  id text primary key,          -- rundgangId__punktId__datum
  datum text,
  faellig boolean not null default false,
  ablauf boolean not null default false,
  verpasst boolean not null default false,
  created_at timestamptz not null default now()
);
alter table checkin_erinnerungen enable row level security;
drop policy if exists "anon_full_access_checkin_erinnerungen" on checkin_erinnerungen;
create policy "anon_full_access_checkin_erinnerungen" on checkin_erinnerungen for all using (true) with check (true);
grant select, insert, update, delete on table checkin_erinnerungen to anon, authenticated;

create index if not exists checkin_erinnerungen_datum_idx on checkin_erinnerungen (datum);
