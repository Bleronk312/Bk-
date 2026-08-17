-- ============================================================================
-- GEKO · Echte Anmeldung — Zwischenschritt: Server-Rolle freischalten
-- ============================================================================
-- BEHOBEN WIRD: "permission denied for table glas_mitarbeiter" in der
-- Edge Function benutzer-verwalten.
--
-- URSACHE: Edge Functions arbeiten mit der Server-Rolle "service_role".
-- Unsere Tabellen wurden aber immer nur für "anon" und "authenticated"
-- freigegeben — service_role ging leer aus. Dasselbe Problem gab es schon
-- einmal bei den Erinnerungs-Functions (supabase_fix_reminder_permissions.sql);
-- damals wurde es nur für vier einzelne Tabellen geflickt. Hier jetzt einmal
-- für ALLE Tabellen, damit es nicht bei jeder neuen Function wieder knallt.
--
-- IST DAS GEFÄHRLICH? Nein. Der service_role-Schlüssel existiert nur auf dem
-- Server (in den Edge Functions), nie im Browser. Bei Supabase ist es sogar
-- der Normalzustand, dass service_role überall drandarf — unsere Tabellen
-- waren durch die Art ihrer Anlage die Ausnahme.
--
-- Gefahrlos ausführbar, ändert nichts am Verhalten der Apps.
-- ============================================================================

grant usage on schema public to service_role;

-- Alle bestehenden Tabellen und Sequenzen:
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Und alles, was künftig dazukommt, automatisch mit:
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- Kontrolle: muss jetzt auch glas_mitarbeiter mit SELECT/INSERT/UPDATE/DELETE
-- für service_role zeigen.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as rechte
from information_schema.table_privileges
where grantee = 'service_role' and table_schema = 'public'
group by table_name
order by table_name;
