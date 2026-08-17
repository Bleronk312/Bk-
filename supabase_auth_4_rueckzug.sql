-- ============================================================================
-- GEKO · NOTBREMSE zu Schritt 4
-- ============================================================================
-- Stellt den offenen Zustand von VOR supabase_auth_4_rls.sql wieder her:
-- jede Tabelle wieder fuer alle erreichbar, wie es die alten
-- "anon_full_access"-Regeln taten. Damit laeuft die ALTE App-Version sofort
-- wieder - inklusive des alten Sicherheitslochs, deshalb nur im Notfall und
-- nur voruebergehend benutzen.
--
-- (Die neue Anmeldung funktioniert danach uebrigens WEITER - offene Tueren
-- stoeren sie nicht. Es muss also nichts zurueckdeployt werden, um das hier
-- auszufuehren.)
-- ============================================================================

-- Alle Schritt-4-Regeln entfernen ...
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ... und ueberall wieder "jeder darf alles" einsetzen:
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create policy "anon_full_access_%s" on public.%I for all using (true) with check (true)',
      t.tablename, t.tablename);
  end loop;
end $$;

grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;

-- Kontrolle: jede Tabelle traegt wieder ihre offene Regel.
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
