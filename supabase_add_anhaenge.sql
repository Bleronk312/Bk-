-- Mehrere Anhänge (Fotos/PDF) pro Abnahmeschein.
-- Die neue Spalte "anhaenge" hält eine Liste [{data, name, type}] als JSON.
-- Der alte Einzel-Anhang (Spalten anhang/anhang_name/anhang_type) bleibt erhalten
-- und wird weiter mit dem ERSTEN Anhang gefüllt (Abwärtskompatibilität).
alter table scheine add column if not exists anhaenge jsonb;
