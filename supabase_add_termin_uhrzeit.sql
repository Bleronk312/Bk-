-- ============================================================================
-- Uhrzeit für Kalender-Termine.
--
-- Bisher stand die Uhrzeit im Titel ("8:40 BMW Bonn", "Bianca 9 Uhr"). Jetzt hat
-- sie ein eigenes Feld und wird in der Tagesansicht und im Monatskalender
-- hervorgehoben angezeigt – und die Termine sind nach Uhrzeit sortiert.
--
-- Format: "HH:MM" als Text (z.B. "08:40"). Leer = ganztägig, wie bisher.
--
-- Ausführen in Supabase → SQL Editor. Läuft auch mehrfach ohne Schaden.
-- ============================================================================

alter table glas_termine add column if not exists uhrzeit text;
