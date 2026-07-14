-- ============================================================================
-- Dietrich LFD-Nummer pro Abnahmeschein (Stopp).
--
-- Dietrich vergibt für JEDEN Abnahmeschein eine eigene laufende Nummer (LFD),
-- neu pro Objekt UND pro Intervall - nicht vorhersagbar, muss händisch
-- eingetragen werden (bei der Tour-Planung oder später nachgetragen).
-- Steht oben rechts auf dem Dietrich-Schein ("LFD Nr.: 99883").
--
-- Einmalig im Supabase SQL Editor ausführen.
-- ============================================================================

alter table glas_stopps add column if not exists lfd_nr text not null default '';
