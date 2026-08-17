-- ============================================================================
-- GEKO · Echte Anmeldung — Schritt 1 von 4: Fundament
-- ============================================================================
-- WICHTIG: Diese Datei ändert NICHTS am laufenden Betrieb.
-- Es kommen nur eine Spalte und drei Hilfsfunktionen dazu. Die Zugriffsregeln
-- bleiben vorerst genau wie bisher — die werden erst in Schritt 4 scharf
-- gestellt, wenn die Apps auf die neue Anmeldung umgestellt sind.
-- Du kannst das hier also gefahrlos jetzt schon ausführen.
--
-- Reihenfolge insgesamt:
--   1) supabase_auth_1_fundament.sql   <- diese Datei
--   2) Edge Function "benutzer-verwalten" deployen (Konten anlegen)
--   3) Apps auf die neue Anmeldung umstellen
--   4) supabase_auth_4_rls.sql         <- macht die Tabellen dicht
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Brücke zwischen Anmeldekonto und Mitarbeiter-Datensatz
-- ---------------------------------------------------------------------------
-- Supabase verwaltet die Konten in auth.users. Alle GEKO-Daten (Touren,
-- Unterschriften, Urlaub, Lager) hängen dagegen an glas_mitarbeiter.id.
-- Diese Spalte verbindet beides — dadurch muss KEIN einziger bestehender
-- Datensatz angefasst oder umgeschrieben werden.
alter table glas_mitarbeiter add column if not exists auth_user_id uuid;

-- Ein Konto darf höchstens einem Mitarbeiter gehören. "where ... is not null"
-- ist wichtig: Mitarbeiter ohne Konto (noch nicht angelegt) müssen weiter
-- erlaubt sein, und mehrere NULL-Werte würden einen normalen unique-Index
-- sonst nicht stören — der Teil-Index macht die Absicht aber eindeutig.
create unique index if not exists idx_glas_mitarbeiter_auth_user
  on glas_mitarbeiter (auth_user_id) where auth_user_id is not null;


-- ---------------------------------------------------------------------------
-- 2) Ist der Aufrufer ein Admin?
-- ---------------------------------------------------------------------------
-- Die Rolle steht in app_metadata des Kontos. Das ist der entscheidende Punkt:
-- app_metadata kann NUR serverseitig gesetzt werden (Service-Role-Schlüssel,
-- also unsere Edge Function). Ein Mitarbeiter kann sich damit nicht selbst zum
-- Admin machen. In user_metadata könnte er sich dagegen eintragen was er will —
-- deshalb wird user_metadata hier bewusst NICHT verwendet.
create or replace function geko_ist_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'geko_rolle', '') = 'admin';
$$;


-- ---------------------------------------------------------------------------
-- 3) Welcher Mitarbeiter-Datensatz gehört zum angemeldeten Konto?
-- ---------------------------------------------------------------------------
-- Liefert die glas_mitarbeiter.id des Angemeldeten, sonst NULL.
-- "security definer" ist hier notwendig, nicht bequem: die Funktion wird in
-- den Zugriffsregeln von glas_mitarbeiter selbst benutzt. Ohne sie würde sich
-- das im Kreis drehen (Regel fragt Funktion, Funktion fällt wieder unter die
-- Regel). "set search_path" gehört fest dazu, damit über den Suchpfad keine
-- untergeschobene Tabelle gelesen werden kann.
create or replace function geko_ma_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.id from glas_mitarbeiter m where m.auth_user_id = auth.uid() limit 1;
$$;

-- Nur angemeldete Konten dürfen die Funktionen aufrufen.
revoke all on function geko_ma_id() from public;
revoke all on function geko_ist_admin() from public;
grant execute on function geko_ma_id() to authenticated;
grant execute on function geko_ist_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- 4) Merker: wurde das Erstpasswort schon geändert?
-- ---------------------------------------------------------------------------
-- Gibt es teilweise schon; hier nur zur Sicherheit, damit Schritt 3 sich
-- darauf verlassen kann.
alter table glas_mitarbeiter add column if not exists pw_muss_wechsel boolean not null default false;
alter table glas_mitarbeiter add column if not exists login_aktiv boolean not null default true;


-- ---------------------------------------------------------------------------
-- 5) DEN ERSTEN ADMIN FREISCHALTEN  (Henne-Ei-Problem)
-- ---------------------------------------------------------------------------
-- Konten legt später die Edge Function an — die verlangt aber schon einen
-- Admin. Der allererste Admin muss deshalb einmalig von Hand entstehen:
--
--   a) Im Supabase-Dashboard:  Authentication → Users → "Add user"
--      E-Mail:   deine echte Adresse (z.B. bleron.kovaci@gekoclean.de)
--      Passwort: ein starkes Passwort, das du dir merkst
--      Haken bei "Auto Confirm User" setzen!
--
--   b) Dann hier unten deine E-Mail eintragen und diesen Block ausführen:

-- update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                            || '{"geko_rolle":"admin"}'::jsonb
--  where email = 'HIER-DEINE-EMAIL-EINTRAGEN';

-- Zum Prüfen, ob es geklappt hat:
-- select email, raw_app_meta_data ->> 'geko_rolle' as rolle from auth.users;
