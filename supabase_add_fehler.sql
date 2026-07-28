-- ============================================================================
-- Flugschreiber: Tabelle für aufgezeichnete Programmfehler.
--
-- Wozu: Wenn ein Mitarbeiter sagt "geht nicht", steht hier drin WAS genau
-- passiert ist – Uhrzeit, Version, Gerät, Seite und die Fehlermeldung. Damit
-- wird aus Raterei eine konkrete Fehlersuche.
--
-- Es werden KEINE Passwörter und keine Formularinhalte gespeichert, nur der
-- Anzeigename des angemeldeten Benutzers und technische Angaben.
--
-- Ausführen in Supabase → SQL Editor. Läuft auch mehrfach ohne Schaden.
-- ============================================================================

create table if not exists app_fehler (
  id        text primary key,
  ts        timestamptz not null default now(),
  seite     text,          -- welche Seite (z.B. checkins-ma)
  version   text,          -- welche App-Version lief (z.B. v107)
  benutzer  text,          -- Anzeigename, KEIN Passwort
  geraet    text,          -- z.B. "iOS 17.4 · Home-Bildschirm"
  meldung   text,          -- die eigentliche Fehlermeldung
  quelle    text,          -- Datei:Zeile
  stack     text,          -- gekürzte Aufrufkette
  online    boolean,       -- war das Gerät online?
  anzahl    integer default 1,
  erledigt  boolean not null default false,
  angelegt  timestamptz not null default now()
);

create index if not exists app_fehler_ts_idx on app_fehler (ts desc);

alter table app_fehler enable row level security;

-- Gleiche Zugriffsregel wie die übrigen Tabellen dieser App.
drop policy if exists anon_full_access on app_fehler;
create policy anon_full_access on app_fehler for all using (true) with check (true);

-- Aufräumen: Fehler, die älter als 90 Tage sind, braucht niemand mehr.
-- (Optional – kann als geplante Aufgabe laufen oder gelegentlich von Hand.)
-- delete from app_fehler where ts < now() - interval '90 days';
