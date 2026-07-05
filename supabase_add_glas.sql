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
-- vertippt/versehentlich Gelöschtes noch retten kann. Archivierte Touren bleiben dauerhaft
-- erhalten, bis sie im Archiv manuell endgültig gelöscht werden (kein Auto-Aufräumen).
alter table glas_touren add column if not exists archiviert_am timestamptz;

-- Früherer 14-Tage-Aufräum-Cron-Job wird entfernt, falls er noch existiert.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'glas-touren-archiv-aufraeumen') then
    perform cron.unschedule('glas-touren-archiv-aufraeumen');
  end if;
end $$;

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

-- Allgemeine Einstellungen für das Glasreinigungs-Modul (aktuell nur eine Zeile mit fester
-- id 'default'). Der Standort ersetzt den bisher fest im Code hinterlegten GLAS_BASE-Punkt
-- als Ausgangspunkt für die Routenoptimierung ("Smart sortieren").
create table if not exists glas_einstellungen (
  id text primary key,
  standort_adresse text not null default '',
  standort_lat double precision,
  standort_lng double precision
);

alter table glas_einstellungen enable row level security;
drop policy if exists "anon_full_access_glas_einstellungen" on glas_einstellungen;
create policy "anon_full_access_glas_einstellungen" on glas_einstellungen for all using (true) with check (true);
grant select, insert, update, delete on table glas_einstellungen to anon, authenticated;

-- Anhänge an freien Terminen: JSON-Array aus {name, dataUrl}, die Bilder werden vor dem
-- Speichern im Browser per Canvas komprimiert (siehe glasCompressImageFile in glas-admin.js),
-- landen also schon stark verkleinert in der Spalte.
alter table glas_termine add column if not exists anhaenge text not null default '[]';

-- Ansprechpartner + Telefonnummer je Objekt (z.B. Hausmeister/Kita-Leitung vor Ort).
alter table glas_objekte add column if not exists ansprechpartner text not null default '';
alter table glas_objekte add column if not exists telefon text not null default '';

-- Ansprechpartner/Telefon als Schnappschuss auf dem Stopp, damit sie in der Mitarbeiter-
-- Tourenansicht (Abnahmeschein) angezeigt und direkt angerufen werden können.
alter table glas_stopps add column if not exists ansprechpartner text not null default '';
alter table glas_stopps add column if not exists telefon text not null default '';

-- Freitext-Hinweise für Mitarbeiter am Objekt (Zugang, Codes, Besonderheiten wie
-- "Hausmeister nur bis 14 Uhr"). Erscheint prominent am Tour-Stopp - aber nur, wenn
-- etwas eingetragen ist.
alter table glas_objekte add column if not exists hinweise text not null default '';
alter table glas_stopps add column if not exists hinweise text not null default '';

-- Freie Notiz je Objekt. Erscheint bei der Tourenplanung und kann dort pro Tour per
-- Häkchen an den Stopp angehängt (und vorher noch angepasst) werden.
alter table glas_objekte add column if not exists notiz text not null default '';
alter table glas_stopps add column if not exists notiz text not null default '';


-- ============================================================================
-- Schein-Vorlage je Objekt ('geko' oder 'sub' = Dietrich). Wird beim
-- "Schein erstellen", bei Einzelscheinen und bei der Tourenplanung
-- automatisch vorausgewählt.
alter table glas_objekte add column if not exists template text not null default 'geko';

-- Aufräumen von Altbeständen: Objekte gelöschter Kunden, offene Stopps gelöschter
-- Objekte und dadurch leer gewordene Touren entfernen. Ab jetzt räumt die App beim
-- Löschen selbst auf - dieser Block bereinigt nur, was früher liegen geblieben ist.
-- Sicher mehrfach ausführbar. Unterschriebene Scheine bleiben unangetastet.
delete from glas_objekte where kunde_id <> '' and kunde_id not in (select id from kunden);
delete from glas_stopps where status <> 'erledigt' and coalesce(objekt_id, '') <> '' and objekt_id not in (select id from glas_objekte);
delete from glas_touren where id not in (select tour_id from glas_stopps);

-- ============================================================================
-- Zusatzleistungen: Mitarbeiter können beim Unterschreiben festhalten, was extra
-- gemacht wurde (z.B. "2 Std. zusätzlich") - steht danach mit auf dem PDF.
alter table glas_stopps add column if not exists zusatz text not null default '';

-- Benachrichtigungs-Schalter (gelten für alle Admin-Geräte und bleiben dauerhaft an,
-- bis sie in den Einstellungen wieder ausgeschaltet werden)
alter table glas_einstellungen add column if not exists push_kalender boolean not null default false;
alter table glas_einstellungen add column if not exists push_unterschrift boolean not null default false;

-- Push-Fix: Ein Gerät darf Admin- UND Mitarbeiter-Benachrichtigungen gleichzeitig
-- abonnieren. Bisher überschrieb der Wechsel zwischen den Seiten die Rolle -
-- DAS war der Grund, warum Benachrichtigungen "immer wieder ausgingen".
alter table push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
create unique index if not exists push_subscriptions_endpoint_role on push_subscriptions(endpoint, role);

-- ============================================================================
-- Kunden-Trennung: Graffiti und Glasreinigung sehen jeweils nur ihre eigenen
-- Kunden ('graffiti' | 'glas' | 'beide'). Die einmalige Zuordnung des Bestands
-- läuft nur beim ALLERERSTEN Ausführen (wenn die Spalte neu entsteht):
-- Kunden mit Glas-Objekten -> 'glas', alle anderen -> 'graffiti'.
-- Danach frei änderbar über das Kunden-Formular in beiden Apps.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'kunden' and column_name = 'bereich') then
    alter table kunden add column bereich text not null default 'beide';
    update kunden set bereich = 'glas' where id in (select kunde_id from glas_objekte where coalesce(kunde_id, '') <> '');
    update kunden set bereich = 'graffiti' where bereich = 'beide';
  end if;
end $$;

-- ============================================================================
-- Urlaubskalender: Mitarbeiter und ihre Urlaubszeiträume. arbeitstage steuert nur
-- die Anzeige der Urlaubstage-Zählung (Mo-Fr = 5-Tage-Woche, Mo-Sa = 6-Tage-Woche).
create table if not exists glas_mitarbeiter (
  id text primary key,
  name text not null default '',
  arbeitstage text not null default 'mo_fr',  -- 'mo_fr' | 'mo_sa'
  created_at timestamptz not null default now()
);
alter table glas_mitarbeiter enable row level security;
drop policy if exists "anon_full_access_glas_mitarbeiter" on glas_mitarbeiter;
create policy "anon_full_access_glas_mitarbeiter" on glas_mitarbeiter for all using (true) with check (true);
grant select, insert, update, delete on table glas_mitarbeiter to anon, authenticated;

create table if not exists glas_urlaub (
  id text primary key,
  mitarbeiter_id text not null references glas_mitarbeiter(id) on delete cascade,
  von date not null,
  bis date,
  notiz text not null default '',
  created_at timestamptz not null default now()
);
alter table glas_urlaub enable row level security;
drop policy if exists "anon_full_access_glas_urlaub" on glas_urlaub;
create policy "anon_full_access_glas_urlaub" on glas_urlaub for all using (true) with check (true);
grant select, insert, update, delete on table glas_urlaub to anon, authenticated;
create index if not exists idx_glas_urlaub_ma on glas_urlaub(mitarbeiter_id);

-- ============================================================================
-- Benachrichtigungen sauber nach App trennen (Runde 16):
-- Rollen sind jetzt 'graffiti' | 'glas' | 'kalender' | 'mitarbeiter' (statt einem
-- gemeinsamen 'admin'). Der alte CHECK erlaubte nur 'admin'/'mitarbeiter' und muss weg.
alter table push_subscriptions drop constraint if exists push_subscriptions_role_check;

-- Neuer Schalter für Touren-Benachrichtigungen (Glasreinigung-App). Bestehende Nutzer,
-- die Kalender-Push an hatten, sollen Touren weiter bekommen -> Wert übernehmen.
alter table glas_einstellungen add column if not exists push_touren boolean not null default false;
update glas_einstellungen set push_touren = push_kalender where id = 'default';

-- Altbestand: bisher meldeten sich alle Admin-Geräte gemeinsam als 'admin' an. Diese
-- Zeilen empfangen nach der Trennung nichts mehr; sie erneuern sich beim nächsten Öffnen
-- der jeweiligen App automatisch mit der richtigen Rolle. Zur Sauberkeit hier entfernen:
delete from push_subscriptions where role = 'admin';

-- ============================================================================
-- Kalender-Termine: Wiederholungen + Adresse (Runde 17)
-- Wiederholung als JSON-Text: {"freq":"woechentlich","wochentage":[1,3,5],"ende":"2026-12-31"}
--   freq: 'taeglich' | 'woechentlich' | 'monatlich' | 'jaehrlich'  (leer/NULL = einmalig)
--   wochentage: nur bei 'woechentlich' relevant (0=So ... 6=Sa), leer = Wochentag des Startdatums
--   ende: optionales Enddatum der Wiederholung (leer = unbegrenzt)
-- Adresse: Klartext-Adresse; im Kalender anklickbar -> öffnet Route in Waze.
alter table glas_termine add column if not exists wiederholung text not null default '';
alter table glas_termine add column if not exists adresse text not null default '';
