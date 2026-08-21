-- ============================================================================
-- GEKO · Sicherheit 2: Nachziehen, was Schritt 4 offen gelassen hat
-- ============================================================================
-- Schritt 4 hat die Tür zugemacht. Hier geht es um das, was INNERHALB der Tür
-- noch zu weit offen stand — also darum, was ein Mitarbeiterkonto anrichten
-- könnte, wenn es in falsche Hände gerät (verlorenes Handy, weitergegebenes
-- Passwort, gekündigter Kollege).
--
-- Gefahrlos einspielbar, ändert nichts an der Bedienung.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Alte Klartext-Passwörter aus der Tabelle werfen
-- ---------------------------------------------------------------------------
-- Bis zur echten Anmeldung standen die Mitarbeiter-Passwörter im Klartext bzw.
-- als selbstgebauter Hash in glas_mitarbeiter. Die Spalten werden von der App
-- nicht mehr gebraucht — pass_klar wird beim Passwortwechsel nur noch auf NULL
-- gesetzt. Solange sie dastehen, sind sie aber ein Fund für jeden, der
-- irgendwann doch einmal Leserechte auf die Tabelle bekommt. Und: Menschen
-- benutzen Passwörter mehrfach, ein alter Klartext ist also womöglich das
-- Mail-Passwort eines Mitarbeiters.
--
-- Erst sichtbar machen, was noch drinsteht:
select count(*) filter (where pass_klar is not null) as noch_klartext,
       count(*) filter (where pass_hash is not null) as noch_hash
  from glas_mitarbeiter;

alter table glas_mitarbeiter drop column if exists pass_klar;
alter table glas_mitarbeiter drop column if exists pass_hash;
alter table glas_mitarbeiter drop column if exists pass_salt;

-- "Zuletzt gesehen": setzt die App bei jedem Start. Daraus baut die Verwaltung
-- die Übersicht, wer gerade angemeldet ist — und sieht damit sofort, wenn sich
-- ein Konto rührt, das sich gar nicht rühren dürfte.
alter table glas_mitarbeiter add column if not exists zuletzt_gesehen timestamptz;

-- Der Wächter auf glas_mitarbeiter nannte pass_klar als erlaubte Spalte. Ohne
-- Anpassung würde er jetzt auf eine Spalte zeigen, die es nicht mehr gibt.
-- zuletzt_gesehen kommt dazu — das ist das Einzige, was ein Mitarbeiter an
-- seiner eigenen Zeile sonst noch ändern darf.
drop trigger if exists geko_schutz_mitarbeiter on glas_mitarbeiter;
create trigger geko_schutz_mitarbeiter before update on glas_mitarbeiter
  for each row execute function geko_nur_spalten(
    'pw_muss_wechsel', 'pw_selbst_gesetzt', 'zuletzt_gesehen');


-- ---------------------------------------------------------------------------
-- 2) Abnahmescheine: Mitarbeiter dürfen ausfüllen, nicht umschreiben
-- ---------------------------------------------------------------------------
-- Bisher: "darf Graffiti" = darf JEDE Spalte JEDES Scheins ändern. Damit könnte
-- ein Mitarbeiterkonto Kundennamen und Adressen umschreiben, fremde
-- Unterschriften setzen oder Scheine als archiviert markieren, sodass sie aus
-- der Übersicht des Büros verschwinden.
--
-- Gebraucht wird nur, was man VOR ORT einträgt. Genau darauf wird es begrenzt.
drop trigger if exists geko_schutz_scheine on scheine;
create trigger geko_schutz_scheine before update on scheine
  for each row execute function geko_nur_spalten(
    'unterschrift', 'unterschrift_name', 'signed_at', 'datum',
    'vorher_fotos', 'nachher_fotos',
    'anhang', 'anhang_name', 'anhang_type', 'anhaenge',
    'material_erfasst', 'material_stunden',
    'material_graffiti_ex_spray', 'material_graffiti_gel', 'material_paint_cleaner',
    'material_streichen', 'material_hochdruck', 'material_sandstrahl', 'material_freitext');


-- ---------------------------------------------------------------------------
-- 3) Glas-Stopps: dasselbe für die Touren
-- ---------------------------------------------------------------------------
-- Steht schon aus Schritt 4, hier nur zur Sicherheit noch einmal — falls das
-- Skript in einer älteren Fassung gelaufen ist.
drop trigger if exists geko_schutz_stopps on glas_stopps;
create trigger geko_schutz_stopps before update on glas_stopps
  for each row execute function geko_nur_spalten(
    'name', 'datum', 'unterschrift', 'zusatz', 'status', 'signed_at', 'positionen', 'erfasst_von');


-- ---------------------------------------------------------------------------
-- 4) Push-Abos: jeder nur seine eigenen Geräte
-- ---------------------------------------------------------------------------
-- Die bisherige Regel enthielt eine Ausnahme für die alte Graffiti-App:
--     or (role = 'mitarbeiter' and geko_darf('graffiti'))
-- Damit durfte JEDER mit Graffiti-Zugang ALLE Abos mit dieser Rolle lesen,
-- ändern und löschen — also die Benachrichtigungen von Kollegen abschalten
-- oder deren Geräte-Adressen auslesen.
--
-- Inzwischen meldet jede App ihre Geräte mit Mitarbeiter-Nummer an
-- (gekoPushAktivierenFuer übergibt sie). Die Ausnahme wird deshalb enger
-- gefasst: nur noch für Zeilen OHNE Mitarbeiter-Nummer, und nur Einfügen —
-- das ist der Altbestand, der sich beim nächsten Anmelden von selbst erledigt.
drop policy if exists "geko_push_eigene" on push_subscriptions;
create policy "geko_push_eigene" on push_subscriptions
  for all to authenticated
  using (geko_ist_admin() or (mitarbeiter_id is not null and mitarbeiter_id = geko_ma_id()))
  with check (geko_ist_admin() or (mitarbeiter_id is not null and mitarbeiter_id = geko_ma_id()));

-- Altbestand ohne Nummer: darf angelegt werden (sonst käme ein Gerät, das die
-- Nummer-Spalte noch nicht kennt, gar nicht mehr an), aber nicht gelesen.
drop policy if exists "geko_push_altbestand" on push_subscriptions;
create policy "geko_push_altbestand" on push_subscriptions
  for insert to authenticated
  with check (mitarbeiter_id is null);


-- ---------------------------------------------------------------------------
-- 5) Fehlerprotokoll: melden ja, ändern nein
-- ---------------------------------------------------------------------------
-- Schritt 4 erlaubte jedem Angemeldeten "update ... using (true)". Damit ließen
-- sich fremde Fehlermeldungen umschreiben — also Spuren verwischen. Melden
-- soll jeder dürfen, verändern nur die Verwaltung.
drop policy if exists "geko_fehler_aktualisieren" on app_fehler;


-- ---------------------------------------------------------------------------
-- 6) Kontrolle
-- ---------------------------------------------------------------------------
-- Erwartet: die drei pass_*-Spalten sind weg.
select column_name from information_schema.columns
 where table_name = 'glas_mitarbeiter' and column_name like 'pass%';

-- Erwartet: je ein Wächter auf glas_mitarbeiter, scheine, glas_stopps,
-- glas_urlaub, glas_lager_plan, glas_objekt_positionen.
select event_object_table as tabelle, trigger_name
  from information_schema.triggers
 where trigger_name like 'geko_schutz%'
 order by 1;
