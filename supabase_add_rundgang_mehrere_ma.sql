-- ============================================================================
-- Mehrere Mitarbeiter je Rundgang (wie bei den Arbeitsorten).
-- mitarbeiter_ids = JSON-Array der zugewiesenen glas_mitarbeiter.id.
-- Leeres Array = "alle dürfen". Das alte Einzelfeld mitarbeiter_id bleibt für
-- Altbestand erhalten (die App liest beides).
-- ============================================================================
alter table checkin_rundgaenge add column if not exists mitarbeiter_ids jsonb not null default '[]'::jsonb;
