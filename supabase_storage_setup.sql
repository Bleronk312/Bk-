-- ============================================================================
-- Foto-Speicher (Supabase Storage) für Vorher-/Nachher-Fotos + Termin-Anhänge
-- ============================================================================
-- Einmal im Supabase SQL-Editor ausführen.
--
-- Hintergrund: Fotos lagen bisher als Base64-Text direkt in den Tabellen -
-- das macht die Datenbank groß und das Laden langsam. Neue Fotos werden ab
-- jetzt als JPEG-Dateien in den öffentlichen Bucket "fotos" hochgeladen, in
-- der Tabelle steht nur noch die kleine URL. Bereits gespeicherte Base64-
-- Fotos funktionieren unverändert weiter.
--
-- Solange dieses SQL NICHT ausgeführt wurde, fällt die App automatisch auf
-- das alte Base64-Verhalten zurück - es geht also nichts kaputt.

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- Anon-Zugriff auf den Bucket (gleiches Sicherheitsmodell wie der Rest der App:
-- Zugriff über geheime Links, keine Benutzerkonten)
drop policy if exists "anon_read_fotos" on storage.objects;
create policy "anon_read_fotos" on storage.objects
  for select using (bucket_id = 'fotos');

drop policy if exists "anon_upload_fotos" on storage.objects;
create policy "anon_upload_fotos" on storage.objects
  for insert with check (bucket_id = 'fotos');

drop policy if exists "anon_delete_fotos" on storage.objects;
create policy "anon_delete_fotos" on storage.objects
  for delete using (bucket_id = 'fotos');
