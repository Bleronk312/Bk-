-- Glasreinigung-Modul: Objekte (Kitas) werden einmal angelegt und wiederverwendet.
-- Touren fassen ausgewählte Objekte für einen Tag zusammen.
-- Komplett getrennt von der Tabelle "scheine" (normale Abnahme).
-- In Supabase SQL Editor einfügen -> Run.

-- Feste Liste aller Kitas/Objekte (einmal anlegen, danach immer wiederverwenden)
create table if not exists glas_objekte (
  id text primary key,
  kunde_id text not null default '',
  kunde_name text not null default '',
  name text not null default '',           -- z.B. "St. Anna / 407"
  adresse text not null default '',
  kdnr text not null default '',           -- z.B. "3806 590 00"
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table glas_objekte enable row level security;
drop policy if exists "anon_full_access_glas_objekte" on glas_objekte;
create policy "anon_full_access_glas_objekte" on glas_objekte for all using (true) with check (true);
grant select, insert, update, delete on table glas_objekte to anon, authenticated;

-- Eine Tour = ein Tag mit ausgewählten Objekten
create table if not exists glas_touren (
  id text primary key,
  datum date,
  template text not null default 'geko',   -- 'geko' oder 'sub'
  notiz text not null default '',
  created_at timestamptz not null default now()
);

alter table glas_touren enable row level security;
drop policy if exists "anon_full_access_glas_touren" on glas_touren;
create policy "anon_full_access_glas_touren" on glas_touren for all using (true) with check (true);
grant select, insert, update, delete on table glas_touren to anon, authenticated;

-- Die Stopps einer Tour (Schnappschuss der Objekt-Daten zum Zeitpunkt der Tour-Erstellung,
-- damit sich nachträgliche Änderungen am Objekt nicht auf bereits unterschriebene Scheine auswirken)
create table if not exists glas_stopps (
  id text primary key,
  tour_id text not null references glas_touren(id) on delete cascade,
  objekt_id text,
  reihenfolge integer not null default 0,
  objekt text not null default '',
  adresse text not null default '',
  kdnr text not null default '',
  lat double precision,
  lng double precision,
  status text not null default 'offen',    -- 'offen' oder 'erledigt'
  name text,                                -- Name der unterschreibenden Person
  datum date,
  unterschrift text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table glas_stopps enable row level security;
drop policy if exists "anon_full_access_glas_stopps" on glas_stopps;
create policy "anon_full_access_glas_stopps" on glas_stopps for all using (true) with check (true);
grant select, insert, update, delete on table glas_stopps to anon, authenticated;

create index if not exists idx_glas_stopps_tour on glas_stopps(tour_id);

grant usage on schema public to anon, authenticated;

-- Nachträgliche Erweiterungen (Kunde-Adresse für Briefkopf, Position/QM für die Leistungszeile,
-- Tourname). Sicher mehrfach ausführbar.
alter table glas_objekte add column if not exists kunde_adresse text not null default '';
alter table glas_objekte add column if not exists position text not null default '10';
alter table glas_objekte add column if not exists qm text not null default '';

alter table glas_stopps add column if not exists kunde_adresse text not null default '';
alter table glas_stopps add column if not exists position text not null default '10';
alter table glas_stopps add column if not exists qm text not null default '';

alter table glas_touren add column if not exists name text not null default '';

-- Feste Liste von Leistungsarten (z.B. "Glas- und Rahmenreinigung", "Grundreinigung"),
-- wird im Admin-Bereich im Reiter "Positionen" gepflegt und beim Anlegen eines
-- Objekts ausgewählt statt frei eingetippt.
create table if not exists glas_positionen (
  id text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);

alter table glas_positionen enable row level security;
drop policy if exists "anon_full_access_glas_positionen" on glas_positionen;
create policy "anon_full_access_glas_positionen" on glas_positionen for all using (true) with check (true);
grant select, insert, update, delete on table glas_positionen to anon, authenticated;

insert into glas_positionen (id, name)
values ('pos_default_glas', 'Glas- und Rahmenreinigung')
on conflict (id) do nothing;

alter table glas_positionen add column if not exists nr text not null default '10';
update glas_positionen set nr = '10' where id = 'pos_default_glas' and nr = '';

-- Mehrere Positionen pro Objekt/Stopp (JSON-Array: [{nr, art, qm}, ...]),
-- ersetzt die alten Einzelfelder "position"/"qm" (bleiben zur Abwärtskompatibilität erhalten).
alter table glas_objekte add column if not exists positionen text not null default '';
alter table glas_stopps add column if not exists positionen text not null default '';

-- ================== Planungs-System (Intervalle, Kalender, Objekt-/Kunden-Seiten) ==================

-- Positionen werden aus dem JSON-Feld "positionen" in eine eigene Tabelle überführt,
-- weil jede Position ihr eigenes Reinigungsintervall + ihr eigenes "zuletzt gemacht"-Datum
-- braucht (z.B. Glasreinigung alle 12 Wochen, Hubsteigereinsatz nur fest im März - am selben
-- Objekt). Das alte JSON-Feld bleibt als Altlast/Fallback bestehen, wird aber nicht mehr
-- befüllt, sobald ein Objekt einmal auf die neue Tabelle migriert wurde.
create table if not exists glas_objekt_positionen (
  id text primary key,
  objekt_id text not null references glas_objekte(id) on delete cascade,
  nr text not null default '10',
  art text not null default '',
  qm text not null default '',
  intervall_typ text not null default '',        -- '' (kein Intervall) | 'rollierend' | 'feste_monate'
  intervall_wochen integer,                       -- nur bei 'rollierend', z.B. 12
  feste_monate text not null default '',          -- nur bei 'feste_monate', z.B. '3,6,9,12'
  letzte_reinigung date,                           -- wird automatisch beim Unterschreiben gesetzt
  faelligkeit_override date,                       -- manuelles Verschieben, hat Vorrang vor Berechnung
  reihenfolge integer not null default 0,
  created_at timestamptz not null default now()
);

alter table glas_objekt_positionen enable row level security;
drop policy if exists "anon_full_access_glas_objekt_positionen" on glas_objekt_positionen;
create policy "anon_full_access_glas_objekt_positionen" on glas_objekt_positionen for all using (true) with check (true);
grant select, insert, update, delete on table glas_objekt_positionen to anon, authenticated;

create index if not exists idx_glas_objekt_positionen_objekt on glas_objekt_positionen(objekt_id);

-- Der Positions-Schnappschuss auf einem Stopp (JSON in glas_stopps.positionen) bekommt
-- zusätzlich ein "id"-Feld je Zeile, das auf glas_objekt_positionen verweist (kann leer sein
-- bei freien/nicht getrackten Positionen aus einem Einzelschein). So lässt sich beim
-- Unterschreiben gezielt nur die "letzte_reinigung" der tatsächlich enthaltenen Positionen
-- aktualisieren, nicht automatisch alle Positionen des Objekts.

-- Freie Einzelscheine: laufen technisch als Mini-Tour mit einem Stopp, damit kein neues
-- Datenmodell nötig ist, sind aber inhaltlich unabhängig von Terminplanung/Intervallen.
alter table glas_touren add column if not exists frei boolean not null default false;

-- Touren können jetzt auch über mehrere Tage laufen (datum = Start, datum_bis = Ende,
-- leer = eintägig wie bisher).
alter table glas_touren add column if not exists datum_bis date;

-- Löschen einer Tour verschiebt sie nur ins Archiv (archiviert_am gesetzt), damit man sich
-- vertippt/versehentlich Gelöschtes noch retten kann. Ein täglicher Cron-Job (siehe unten)
-- entfernt archivierte Touren endgültig nach 14 Tagen.
alter table glas_touren add column if not exists archiviert_am timestamptz;

create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'glas-touren-archiv-aufraeumen') then
    perform cron.unschedule('glas-touren-archiv-aufraeumen');
  end if;
end $$;
select cron.schedule(
  'glas-touren-archiv-aufraeumen',
  '0 3 * * *',
  $$ delete from glas_touren where archiviert_am is not null and archiviert_am < now() - interval '14 days'; $$
);

-- Freie Kalender-Termine (unabhängig von Touren): Titel, Farbe, Zeitraum, Erinnerung, Notiz.
-- Angelehnt an den TimeTree-Eintrag - erscheinen als eigene Balken im Kalender.
create table if not exists glas_termine (
  id text primary key,
  titel text not null default '',
  datum date not null,
  datum_bis date,
  farbe text not null default 'blau',       -- 'blau' | 'gruen' | 'gelb' | 'rot' | 'lila' | 'grau'
  erinnerung text not null default '',      -- '' | 'same_day' | '1d' | '2d' | '7d'
  notiz text not null default '',
  created_at timestamptz not null default now()
);

alter table glas_termine enable row level security;
drop policy if exists "anon_full_access_glas_termine" on glas_termine;
create policy "anon_full_access_glas_termine" on glas_termine for all using (true) with check (true);
grant select, insert, update, delete on table glas_termine to anon, authenticated;

-- Haupt-Kundennummer des Kunden als Schnappschuss auf dem Stopp: das GEKO-Template zeigt
-- immer diese Nummer; das Dietrich-Template zeigt die zusätzliche Dietrich-Kdnr des Objekts
-- (Feld "kdnr") und fällt auf die Haupt-Kundennummer zurück, wenn dort nichts eingetragen ist.
alter table glas_stopps add column if not exists kunde_kdnr text not null default '';

