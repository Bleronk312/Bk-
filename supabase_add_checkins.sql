-- ============================================================================
-- GEKO Check-ins (GPS-Rundgänge / Bestreifungsnachweis)
-- Eigene App (checkins-admin.html + checkins-ma.html), gleicher Server, gleiche DB.
-- Die Mitarbeiter melden sich mit DENSELBEN Konten wie in der Glas-App an
-- (Tabelle glas_mitarbeiter). Über zwei neue Häkchen steuert der Admin, WO ein
-- Login funktioniert (Glas-Touren und/oder Check-ins).
-- ============================================================================

-- ---- Per-App-Zugang: welche App darf dieser Login öffnen? -------------------
-- zugang_glas    = darf sich in der Glas-Touren-App anmelden (Standard: JA, damit
--                  bestehende Konten NICHT versehentlich ausgesperrt werden)
-- zugang_checkin = darf sich in der Check-ins-App anmelden (Standard: NEIN, muss
--                  vom Admin bewusst freigeschaltet werden)
alter table glas_mitarbeiter add column if not exists zugang_glas boolean not null default true;
alter table glas_mitarbeiter add column if not exists zugang_checkin boolean not null default false;

-- ---- GPS-Punkte (die "Sticker"-Standorte) -----------------------------------
create table if not exists checkin_punkte (
  id text primary key,
  name text not null,
  adresse text,
  lat double precision,
  lng double precision,
  radius integer not null default 100,      -- erlaubter Umkreis in Metern
  fenster_von text,                          -- optionales Standard-Zeitfenster "HH:MM"
  fenster_bis text,
  toleranz_min integer not null default 30,  -- Standard-Toleranz in Minuten
  hinweis text,                              -- Hinweis für den Mitarbeiter
  created_at timestamptz not null default now()
);
alter table checkin_punkte enable row level security;
drop policy if exists "anon_full_access_checkin_punkte" on checkin_punkte;
create policy "anon_full_access_checkin_punkte" on checkin_punkte for all using (true) with check (true);
grant select, insert, update, delete on table checkin_punkte to anon, authenticated;

-- ---- Rundgänge (Touren aus mehreren Punkten) --------------------------------
-- punkte = JSON-Array in fester Reihenfolge:
--   [{ "punkt_id": "...", "fenster_von": "08:00", "fenster_bis": "08:30", "toleranz_min": 15 }, ...]
--   fenster_von/bis/toleranz_min pro Punkt sind optional (leer = Standard des Rundgangs
--   bzw. des Punkts).
create table if not exists checkin_rundgaenge (
  id text primary key,
  name text not null,
  mitarbeiter_id text,                       -- null = alle dürfen; sonst glas_mitarbeiter.id
  tage text not null default '1,2,3,4,5',    -- Wochentage 1=Mo … 7=So, kommagetrennt
  fenster_von text not null default '06:00', -- Standard-Zeitfenster des Rundgangs
  fenster_bis text not null default '10:00',
  toleranz_min integer not null default 30,  -- Standard-Toleranz des Rundgangs
  punkte jsonb not null default '[]'::jsonb,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);
alter table checkin_rundgaenge enable row level security;
drop policy if exists "anon_full_access_checkin_rundgaenge" on checkin_rundgaenge;
create policy "anon_full_access_checkin_rundgaenge" on checkin_rundgaenge for all using (true) with check (true);
grant select, insert, update, delete on table checkin_rundgaenge to anon, authenticated;

-- ---- Check-in-Protokoll (jeder erfolgreiche Scan) ---------------------------
create table if not exists checkin_logs (
  id text primary key,
  rundgang_id text,
  punkt_id text,
  mitarbeiter_id text,
  mitarbeiter_name text,                     -- Anzeigename zum Zeitpunkt des Check-ins
  ts timestamptz not null default now(),     -- exakter Zeitpunkt des Check-ins
  datum text,                                -- lokales Datum "YYYY-MM-DD" (für Tages-/Monatsauswertung)
  lat double precision,
  lng double precision,
  distanz_m integer,                         -- gemessene Entfernung zum Punkt in Metern
  created_at timestamptz not null default now()
);
alter table checkin_logs enable row level security;
drop policy if exists "anon_full_access_checkin_logs" on checkin_logs;
create policy "anon_full_access_checkin_logs" on checkin_logs for all using (true) with check (true);
grant select, insert, update, delete on table checkin_logs to anon, authenticated;

create index if not exists checkin_logs_datum_idx on checkin_logs (datum);
create index if not exists checkin_logs_rundgang_idx on checkin_logs (rundgang_id);
