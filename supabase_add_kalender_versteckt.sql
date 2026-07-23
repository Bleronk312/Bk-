-- ============================================================================
-- Einzelne Touren aus der Kalenderansicht ausblenden (z.B. nicht geklappte Touren,
-- versehentlich doppelt erstellte Blankos). Betrifft NUR den Kalender – die Touren-
-- Liste und die Statistik bleiben unberührt.
-- ============================================================================
alter table glas_touren add column if not exists kalender_versteckt boolean not null default false;
