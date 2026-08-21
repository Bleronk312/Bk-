-- ============================================================================
-- GEKO · Sicherheit 1: Foto-Speicher — Schreiben und Löschen zumachen
-- ============================================================================
-- WAS WAR DAS PROBLEM?
-- Der Bucket "fotos" (Vorher-/Nachher-Bilder, Termin-Anhänge) stammt aus der
-- Zeit VOR der echten Anmeldung. Damals lautete das Sicherheitsmodell "wer den
-- Link kennt, darf". Die Regeln lauten deshalb bis heute:
--
--     for select using (bucket_id = 'fotos')      -- jeder darf lesen
--     for insert with check (bucket_id = 'fotos') -- jeder darf hochladen
--     for delete using (bucket_id = 'fotos')      -- jeder darf LÖSCHEN
--
-- Ohne "to authenticated" gelten sie für JEDEN — auch für den öffentlichen
-- anon-Schlüssel, der in js/config.js steht und damit Allgemeinwissen ist.
--
-- Konkret konnte bis jetzt jeder, der den Quelltext liest:
--   * ALLE Vorher-/Nachher-Fotos löschen — euren Nachweis gegenüber dem Kunden,
--   * beliebige Dateien in euren Speicher legen und über eure Adresse
--     verteilen (Schadsoftware unter dem Namen GEKO Clean).
--
-- Schritt 4 hat das NICHT erwischt: dort ging es um das Schema "public", der
-- Datei-Speicher liegt in "storage" und hat eigene Regeln.
--
-- ----------------------------------------------------------------------------
-- WARUM BLEIBT DAS LESEN VORERST OFFEN? (ehrlich gesagt)
-- Die App legt die Fotos als ÖFFENTLICHE Adresse in den Tabellen ab
-- (…/object/public/fotos/…) und zeigt sie direkt als Bild an. Stellt man den
-- Bucket jetzt auf privat, sind ALLE bestehenden Fotos in allen Abnahme-
-- scheinen sofort tot — auch die in bereits unterschriebenen.
--
-- Das sauber umzustellen heißt: Pfade statt Adressen speichern, Anzeige über
-- signierte Links, Altbestand umschreiben. Das ist ein eigener Umbau und
-- gehört nicht in eine Nacht vor der Inbetriebnahme. Er steht in
-- supabase_sicherheit_3_fotos_privat.sql als NÄCHSTER Schritt bereit.
--
-- Restrisiko bis dahin: Wer eine Foto-Adresse kennt, kann das Bild sehen.
-- Die Adressen enthalten Zeitstempel + Zufallszeichen, sind also nicht zu
-- erraten — aber sie sind auch nicht geheim. Löschen und Hochladen, also der
-- gefährliche Teil, ist ab sofort dicht.
-- ============================================================================

-- 1) Grenzen für Uploads (gilt sofort, bricht nichts) -------------------------
update storage.buckets
   set file_size_limit = 15728640,                       -- 15 MB je Datei
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'fotos';

-- 2) Die alten Jedermann-Regeln entfernen -------------------------------------
drop policy if exists "anon_read_fotos"   on storage.objects;
drop policy if exists "anon_upload_fotos" on storage.objects;
drop policy if exists "anon_delete_fotos" on storage.objects;

-- 3) Neue Regeln --------------------------------------------------------------
-- Lesen über die Datenbank-Schnittstelle: nur Angemeldete. (Der direkte
-- öffentliche Bild-Link bleibt vorerst bestehen, siehe Kopf der Datei.)
drop policy if exists "geko_fotos_lesen" on storage.objects;
create policy "geko_fotos_lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos');

-- Hochladen: nur Angemeldete. Mitarbeiter fotografieren vor Ort, das ist gewollt.
drop policy if exists "geko_fotos_hochladen" on storage.objects;
create policy "geko_fotos_hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos');

-- LÖSCHEN nur die Verwaltung. Ein Foto ist der Nachweis, dass eine Leistung
-- erbracht wurde — das darf nicht jeder wegräumen können, weder versehentlich
-- noch mit Absicht.
--
-- Hinweis: Die App räumt beim Bearbeiten eines Scheins alte Fotos auf
-- (deleteFotoFromStorage). Für Mitarbeiter läuft das ab jetzt ins Leere; das
-- ist Absicht und harmlos — es bleibt höchstens eine verwaiste Datei liegen,
-- statt dass ein Beweisfoto verschwindet.
drop policy if exists "geko_fotos_loeschen" on storage.objects;
create policy "geko_fotos_loeschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and geko_ist_admin());

-- Überschreiben (update) bewusst NICHT erlaubt: ein bestehendes Beweisfoto
-- soll niemand still gegen ein anderes tauschen können.

-- 4) Kontrolle ----------------------------------------------------------------
-- Erwartet: bei "fotos" stehen Größenlimit und erlaubte Typen; in der Regelliste
-- taucht KEINE "anon_…"-Regel mehr auf.
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets where id in ('fotos', 'lohn');

select policyname, cmd, roles
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by policyname;
