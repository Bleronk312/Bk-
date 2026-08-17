-- ============================================================================
-- GEKO · Lohnabrechnungen verteilen
-- ============================================================================
-- Die PDFs liegen im Datei-Speicher von Supabase (Storage), NICHT in den
-- Tabellen. Der Speicher ist privat und hat eigene Zugriffsregeln - dieses
-- Skript ist deshalb auch VOR dem RLS-Stichtag gefahrlos ausführbar: ohne
-- Anmeldung kommt hier niemand an eine Datei.
--
-- Ablage: ein Ordner je Mitarbeiter (glas_mitarbeiter.id), darin je Monat
-- eine Datei "JJJJ-MM.pdf". Beispiel:  K7X2P9/2026-08.pdf
--
-- Rechte:
--   Ober-Admin  -> hochladen, ansehen, löschen (alles)
--   Mitarbeiter -> NUR die Dateien im eigenen Ordner ansehen
--   Normale Admins bewusst NICHT: Lohn ist die sensibelste Information im
--   Haus und bleibt beim Ober-Admin.
-- ============================================================================

-- Wer ist der Ober-Admin? (gleiche Quelle wie in der Edge Function:
-- app_metadata, nur serverseitig setzbar)
create or replace function geko_ist_oberadmin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'geko_super')::boolean, false);
$$;
revoke all on function geko_ist_oberadmin() from public;
grant execute on function geko_ist_oberadmin() to authenticated;

-- Privater Ablage-Ort, nur PDF, max. 10 MB je Datei
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lohn', 'lohn', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

-- Ober-Admin: alles
drop policy if exists "geko_lohn_oberadmin" on storage.objects;
create policy "geko_lohn_oberadmin" on storage.objects
  for all to authenticated
  using (bucket_id = 'lohn' and geko_ist_oberadmin())
  with check (bucket_id = 'lohn' and geko_ist_oberadmin());

-- Mitarbeiter: nur den eigenen Ordner lesen. Der Ordnername ist die eigene
-- Mitarbeiter-Nummer - geko_ma_id() liefert sie aus der laufenden Anmeldung.
drop policy if exists "geko_lohn_eigene" on storage.objects;
create policy "geko_lohn_eigene" on storage.objects
  for select to authenticated
  using (bucket_id = 'lohn' and (storage.foldername(name))[1] = geko_ma_id());

-- Kontrolle: beide Regeln müssen erscheinen
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'geko_lohn%';
