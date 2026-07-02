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


