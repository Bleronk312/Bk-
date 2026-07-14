-- ============================================================================
-- Behebt: "permission denied for table scheine" (bzw. glas_termine / glas_touren)
-- in der Edge-Function "daily-reminders".
--
-- Ursache: Die Function läuft mit dem SERVICE_ROLE-Schlüssel. Die Datentabellen
-- wurden per rohem SQL angelegt und nur an anon/authenticated freigegeben - die
-- Rolle "service_role" hatte nie ein GRANT. Dadurch stürzte die Function jeden
-- Morgen mit 500 ab und es kamen keine Erinnerungen an.
--
-- Einmalig im Supabase SQL Editor ausführen.
-- ============================================================================

grant usage on schema public to service_role;

-- Lesend: die Function fragt diese Tabellen nur ab.
grant select on table scheine      to service_role;
grant select on table glas_termine to service_role;
grant select on table glas_touren  to service_role;

-- push_subscriptions: lesen + veraltete Endpunkte (410/404) aufräumen.
grant select, delete on table push_subscriptions to service_role;

-- Damit künftig neu angelegte Tabellen im Schema public automatisch für
-- service_role lesbar sind (verhindert das gleiche Problem beim nächsten Mal):
alter default privileges in schema public grant select on tables to service_role;

-- Zur Kontrolle: zeigt, worauf service_role jetzt Zugriff hat.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'service_role'
  and table_name in ('scheine', 'glas_termine', 'glas_touren', 'push_subscriptions')
order by table_name, privilege_type;
