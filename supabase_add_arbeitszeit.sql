-- ============================================================================
-- GEKO Check-ins – Arbeitszeit (Ein-/Auschecken an einem Objekt)
-- Ergänzt die Rundgänge um eine reine Stempeluhr mit GPS. Der Admin legt
-- Arbeitsorte an (feste Zeiten pro Wochentag, Umkreis, Puffer) und weist
-- Mitarbeiter zu. Nur diese sehen den Reiter "Arbeitszeit".
-- Voraussetzung: supabase_add_checkins.sql ist bereits ausgeführt.
-- ============================================================================

-- ---- Arbeitsorte (Objekte zum Ein-/Auschecken) ------------------------------
-- zeiten = JSON je Wochentag (1=Mo … 7=So): {"1":{"von":"07:00","bis":"16:00"}, ...}
--          Tage ohne Eintrag = an dem Tag kein Ein-/Auschecken.
-- mitarbeiter_ids = JSON-Array der zugewiesenen glas_mitarbeiter.id.
create table if not exists checkin_orte (
  id text primary key,
  name text not null,
  adresse text,
  lat double precision,
  lng double precision,
  radius integer not null default 100,       -- erlaubter Umkreis in Metern (ein + aus)
  zeiten jsonb not null default '{}'::jsonb,  -- feste Zeiten je Wochentag
  puffer_min integer not null default 5,      -- erlaubter Puffer am Rand (Knopf), zählt NICHT als Zeit
  mitarbeiter_ids jsonb not null default '[]'::jsonb,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);
alter table checkin_orte enable row level security;
drop policy if exists "anon_full_access_checkin_orte" on checkin_orte;
create policy "anon_full_access_checkin_orte" on checkin_orte for all using (true) with check (true);
grant select, insert, update, delete on table checkin_orte to anon, authenticated;

-- ---- Schichten (eine Ein-/Auscheck-Runde) -----------------------------------
-- Offene Schicht = ein_ts gesetzt, aus_ts NULL.
-- dauer_min = gezählte Zeit, immer gecappt auf das geplante Fenster [von, bis]
--             (nichts vor Start / nach Ende wird gezählt).
create table if not exists checkin_schichten (
  id text primary key,
  ort_id text,
  mitarbeiter_id text,
  mitarbeiter_name text,
  datum text,                                 -- lokales Datum "YYYY-MM-DD"
  ein_ts timestamptz,
  ein_lat double precision,
  ein_lng double precision,
  ein_dist integer,
  aus_ts timestamptz,
  aus_lat double precision,
  aus_lng double precision,
  aus_dist integer,
  dauer_min integer,                          -- gezählte Minuten (gecappt), erst beim Auschecken
  auto_beendet boolean not null default false,-- true = automatisch geschlossen (Auschecken vergessen)
  created_at timestamptz not null default now()
);
alter table checkin_schichten enable row level security;
drop policy if exists "anon_full_access_checkin_schichten" on checkin_schichten;
create policy "anon_full_access_checkin_schichten" on checkin_schichten for all using (true) with check (true);
grant select, insert, update, delete on table checkin_schichten to anon, authenticated;

create index if not exists checkin_schichten_datum_idx on checkin_schichten (datum);
create index if not exists checkin_schichten_ma_idx on checkin_schichten (mitarbeiter_id);
create index if not exists checkin_schichten_offen_idx on checkin_schichten (aus_ts);
