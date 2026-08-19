-- ============================================================================
-- GEKO · Echte Anmeldung — Schritt 4: Die Datenbank dichtmachen (RLS)
-- ============================================================================
-- ⚠️  DAS IST DER STICHTAG-SCHRITT. Ab dem Moment, in dem dieses Skript läuft:
--     - antwortet die Datenbank NUR noch angemeldeten Konten
--     - ist die ALTE Anmeldung (alte App-Version auf main) sofort tot
--     Also: erst ausführen, wenn der neue Stand veröffentlicht ist und die
--     Zettel mit den Einmal-Passwörtern bereitliegen.
--
-- 🔙  Notbremse: supabase_auth_4_rueckzug.sql stellt in einer Minute den
--     offenen Zustand wieder her, falls etwas Wichtiges klemmt.
--
-- Die Logik in Kurzform:
--   - Verwaltung (geko_rolle = 'admin' im Konto): darf alles, in jeder Tabelle.
--   - Mitarbeiter: nur das, was seine Apps wirklich brauchen — eigene Zeile,
--     eigener Urlaub, Touren lesen + unterschreiben, Check-ins buchen usw.
--   - Nicht angemeldet: gar nichts. Der oeffentliche anon-Schluessel verliert
--     jeden Tabellenzugriff.
--   - Edge Functions (service_role) laufen an allen Regeln vorbei - unveraendert.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Vorbereitungen
-- ---------------------------------------------------------------------------
-- Spalte existiert je nach Installationsstand evtl. noch nicht:
alter table push_subscriptions add column if not exists mitarbeiter_id text;

-- Darf der Angemeldete diesen Bereich benutzen? Gleiche Logik wie in den Apps:
-- Glas ist "an, ausser ausdruecklich aus", die anderen muessen ausdruecklich an
-- sein. security definer noetig, weil die Funktion aus Policies heraus die
-- Tabelle glas_mitarbeiter liest, die selbst unter RLS steht.
create or replace function geko_darf(bereich text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare m glas_mitarbeiter%rowtype;
begin
  if geko_ist_admin() then return true; end if;
  select * into m from glas_mitarbeiter where auth_user_id = auth.uid() limit 1;
  if not found or m.login_aktiv = false then return false; end if;
  return case bereich
    when 'glas'     then m.zugang_glas is distinct from false
    when 'checkin'  then m.zugang_checkin is true
    when 'graffiti' then m.zugang_graffiti is true
    when 'lager'    then m.zugang_lager is true
    else true
  end;
end $$;
revoke all on function geko_darf(text) from public;
grant execute on function geko_darf(text) to authenticated;

-- Trigger-Wächter: Mitarbeiter duerfen an einer Zeile nur die aufgezaehlten
-- Spalten aendern (die Spaltennamen kommen als Trigger-Argumente). Der
-- jsonb-Vergleich funktioniert unabhaengig davon, welche Spalten die Tabelle
-- in dieser Installation gerade hat. Admins sind ausgenommen.
create or replace function geko_nur_spalten()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if geko_ist_admin() then return new; end if;
  if (to_jsonb(new.*) - tg_argv) is distinct from (to_jsonb(old.*) - tg_argv) then
    raise exception 'Diese Änderung darf nur die Verwaltung machen.';
  end if;
  return new;
end $$;


-- ---------------------------------------------------------------------------
-- 1) Reiner Tisch: alle bisherigen Zugriffsregeln entfernen
-- ---------------------------------------------------------------------------
-- Die alten Regeln heissen alle "anon_full_access_..." und erlauben jedem
-- alles - genau das Loch, das hier zugeht.
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- RLS auf JEDER Tabelle im Schema einschalten - auch auf solchen, die spaeter
-- dazukommen koennten und hier nicht einzeln aufgezaehlt sind. Ohne Regel gilt
-- dann automatisch: niemand kommt ran (ausser service_role).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Den oeffentlichen anon-Schluessel komplett aussperren. Er steht in js/config.js
-- und ist damit Allgemeinwissen - er darf nur noch zum Anmelden dienen, nicht
-- fuer Tabellenzugriffe.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Angemeldete Konten behalten die Grundrechte; WAS sie damit duerfen,
-- entscheiden ab jetzt die Regeln unten.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;


-- ---------------------------------------------------------------------------
-- 2) Verwaltung darf alles - eine Regel pro Tabelle, automatisch fuer alle
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create policy "geko_admin_alles" on public.%I for all to authenticated using (geko_ist_admin()) with check (geko_ist_admin())',
      t.tablename);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 3) Mitarbeiter-Regeln - pro Tabelle genau das, was die Apps brauchen
-- ---------------------------------------------------------------------------
-- Nicht aufgefuehrte Tabellen (kunden, kategorien, glas_objekte, glas_termine,
-- glas_positionen, glas_objekt_positionen, checkin_erinnerungen, ...) bleiben
-- reine Verwaltungssache - dank Abschnitt 2 ist die Verwaltung dort schon drin.

-- === glas_mitarbeiter: nur die eigene Zeile sehen; daran nur die
--     Passwort-Merker aendern (fuer "Erstpasswort geaendert") ===============
create policy "geko_ma_selbst_lesen" on glas_mitarbeiter
  for select to authenticated using (auth_user_id = auth.uid());
create policy "geko_ma_selbst_aendern" on glas_mitarbeiter
  for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
drop trigger if exists geko_schutz_mitarbeiter on glas_mitarbeiter;
create trigger geko_schutz_mitarbeiter before update on glas_mitarbeiter
  for each row execute function geko_nur_spalten('pass_klar', 'pw_muss_wechsel', 'pw_selbst_gesetzt');

-- === glas_urlaub: eigenen Urlaub sehen, Antrag stellen, Antwort quittieren,
--     nicht genehmigte Antraege zurueckziehen. Genehmigen kann nur die
--     Verwaltung - ein selbst eingetragener Antrag MUSS als 'offen' rein.
--     ('offen' ist der Wert, den GEKO One tatsaechlich schreibt; die Stufen
--     sind 'offen' -> 'genehmigt' / 'abgelehnt'. Steht hier ein anderer Wert,
--     kann kein Mitarbeiter mehr Urlaub beantragen.) ========================
create policy "geko_ma_urlaub_lesen" on glas_urlaub
  for select to authenticated using (mitarbeiter_id = geko_ma_id());
create policy "geko_ma_urlaub_beantragen" on glas_urlaub
  for insert to authenticated
  with check (mitarbeiter_id = geko_ma_id() and status = 'offen');
create policy "geko_ma_urlaub_quittieren" on glas_urlaub
  for update to authenticated
  using (mitarbeiter_id = geko_ma_id()) with check (mitarbeiter_id = geko_ma_id());
create policy "geko_ma_urlaub_zurueckziehen" on glas_urlaub
  for delete to authenticated
  using (mitarbeiter_id = geko_ma_id() and coalesce(status, 'genehmigt') <> 'genehmigt');
drop trigger if exists geko_schutz_urlaub on glas_urlaub;
create trigger geko_schutz_urlaub before update on glas_urlaub
  for each row execute function geko_nur_spalten('gesehen_am');

-- === Glas-Touren: lesen + Stopps unterschreiben ============================
create policy "geko_ma_touren_lesen" on glas_touren
  for select to authenticated using (geko_darf('glas'));
create policy "geko_ma_stopps_lesen" on glas_stopps
  for select to authenticated using (geko_darf('glas'));
create policy "geko_ma_stopps_unterschreiben" on glas_stopps
  for update to authenticated
  using (geko_darf('glas')) with check (geko_darf('glas'));
drop trigger if exists geko_schutz_stopps on glas_stopps;
create trigger geko_schutz_stopps before update on glas_stopps
  for each row execute function
  geko_nur_spalten('name', 'datum', 'unterschrift', 'zusatz', 'status', 'signed_at', 'positionen', 'erfasst_von');

-- === Objekt-Positionen: beim Unterschreiben setzt die Mitarbeiter-App
--     "zuletzt gereinigt" auf den Positionen des Scheins zurueck (glasSignStop
--     in glas-shared.js). Ohne diese Regel liefe das ins Leere - und zwar
--     STILL: die Unterschrift saesse, nur die Faelligkeiten wuerden nie wieder
--     weiterwandern. Der Fehler waere erst Wochen spaeter aufgefallen.
--     Absichtlich KEINE Leseregel: gebraucht wird nur das Schreiben, und der
--     Waechter nagelt es auf genau diese zwei Spalten fest. ==================
create policy "geko_ma_positionen_reinigung" on glas_objekt_positionen
  for update to authenticated
  using (geko_darf('glas')) with check (geko_darf('glas'));
drop trigger if exists geko_schutz_positionen on glas_objekt_positionen;
create trigger geko_schutz_positionen before update on glas_objekt_positionen
  for each row execute function geko_nur_spalten('letzte_reinigung', 'faelligkeit_override');

-- === Einstellungen (Firmenname usw.): jeder Angemeldete darf lesen =========
create policy "geko_einstellungen_lesen" on glas_einstellungen
  for select to authenticated using (true);

-- === Abnahmescheine (Graffiti): lesen + ausfuellen fuer Freigeschaltete.
--     Anlegen und Loeschen bleibt Verwaltung ================================
create policy "geko_ma_scheine_lesen" on scheine
  for select to authenticated using (geko_darf('graffiti'));
create policy "geko_ma_scheine_ausfuellen" on scheine
  for update to authenticated
  using (geko_darf('graffiti')) with check (geko_darf('graffiti'));

-- === Lager-Plan: nur Eintraege sehen/bestaetigen, in denen man selbst steht =
create policy "geko_ma_lager_lesen" on glas_lager_plan
  for select to authenticated
  using (geko_darf('lager') and mitarbeiter_ids @> jsonb_build_array(geko_ma_id()));
create policy "geko_ma_lager_bestaetigen" on glas_lager_plan
  for update to authenticated
  using (geko_darf('lager') and mitarbeiter_ids @> jsonb_build_array(geko_ma_id()))
  with check (geko_darf('lager') and mitarbeiter_ids @> jsonb_build_array(geko_ma_id()));
drop trigger if exists geko_schutz_lager on glas_lager_plan;
create trigger geko_schutz_lager before update on glas_lager_plan
  for each row execute function geko_nur_spalten('bestaetigt');

-- === Check-ins: Orte/Punkte/Rundgaenge lesen; Buchungen nur im EIGENEN Namen.
--     (Die with-check-Klausel verhindert, dass jemand Check-ins oder
--     Schichten fuer einen Kollegen erfindet.) ==============================
create policy "geko_ma_ci_orte_lesen" on checkin_orte
  for select to authenticated using (geko_darf('checkin'));
create policy "geko_ma_ci_punkte_lesen" on checkin_punkte
  for select to authenticated using (geko_darf('checkin'));
create policy "geko_ma_ci_rundgaenge_lesen" on checkin_rundgaenge
  for select to authenticated using (geko_darf('checkin'));
create policy "geko_ma_ci_logs_lesen" on checkin_logs
  for select to authenticated using (geko_darf('checkin'));
create policy "geko_ma_ci_logs_buchen" on checkin_logs
  for insert to authenticated
  with check (geko_darf('checkin') and mitarbeiter_id = geko_ma_id());
create policy "geko_ma_ci_schichten_lesen" on checkin_schichten
  for select to authenticated using (geko_darf('checkin'));
create policy "geko_ma_ci_schicht_beginnen" on checkin_schichten
  for insert to authenticated
  with check (geko_darf('checkin') and mitarbeiter_id = geko_ma_id());
create policy "geko_ma_ci_schicht_beenden" on checkin_schichten
  for update to authenticated
  using (geko_darf('checkin') and mitarbeiter_id = geko_ma_id())
  with check (geko_darf('checkin') and mitarbeiter_id = geko_ma_id());

-- === Push-Abos: jeder verwaltet seine eigenen Geraete. Die Graffiti-App
--     meldet ihre Geraete historisch ohne Mitarbeiter-Nummer an (role
--     'mitarbeiter'), deshalb die dritte Klausel ============================
create policy "geko_push_eigene" on push_subscriptions
  for all to authenticated
  using (geko_ist_admin() or mitarbeiter_id = geko_ma_id()
         or (role = 'mitarbeiter' and geko_darf('graffiti')))
  with check (geko_ist_admin() or mitarbeiter_id = geko_ma_id()
         or (role = 'mitarbeiter' and geko_darf('graffiti')));

-- === Fehlerprotokoll: jede angemeldete App darf Fehler melden; lesen und
--     aufraeumen bleibt Verwaltung ==========================================
create policy "geko_fehler_melden" on app_fehler
  for insert to authenticated with check (true);
create policy "geko_fehler_aktualisieren" on app_fehler
  for update to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------------
-- 4) Kontrolle
-- ---------------------------------------------------------------------------
-- Zeigt alle Tabellen mit der Zahl ihrer Regeln. Jede Tabelle muss mindestens
-- 1 haben (die Verwaltungsregel). KEINE darf mehr eine "anon_..."-Regel tragen.
select t.tablename,
       count(p.policyname) as regeln,
       string_agg(p.policyname, ', ' order by p.policyname) as namen
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename
order by t.tablename;
