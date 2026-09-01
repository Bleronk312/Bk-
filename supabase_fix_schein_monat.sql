-- ===========================================================================
-- FIX: Mitarbeiter können Abnahmescheine nicht mehr unterschreiben
--      ("Diese Änderung darf nur die Verwaltung machen.")
--
-- WAS WAR LOS
-- Beim Unterschreiben schreibt die Graffiti-App auch die Spalte "monat" - das
-- ist die Zeile "Auszuführende Arbeiten Monat" auf dem Schein. Sie richtet sich
-- nach dem Tag der UNTERSCHRIFT, nicht nach dem Tag, an dem der Schein angelegt
-- wurde (sonst stünde bei einem Termin im Folgemonat der falsche Monat drauf).
--
-- Im Wächter geko_schutz_scheine (supabase_sicherheit_2_haerten.sql) fehlte
-- "monat" in der Liste der erlaubten Spalten. Der Wächter schlägt aber nur an,
-- wenn sich eine nicht erlaubte Spalte TATSÄCHLICH ÄNDERT:
--
--   Schein aus September, am 01.09. unterschrieben -> "monat" bleibt
--     "September"    -> geht durch
--   Schein aus August, am 01.09. unterschrieben    -> "monat" wird
--     "August" -> "September"   -> ABGELEHNT
--
-- Deshalb lief beim Testen im August alles, und am 1. September stand die
-- ganze Graffiti-Abteilung. Betroffen war jeder Schein, dessen Unterschrift in
-- einen anderen Monat fällt als seine Anlage - also an jedem Monatswechsel neu.
--
-- LÖSUNG
-- "monat" gehört zu dem, was vor Ort ausgefüllt wird, und kommt in die Liste.
-- Gefährlich ist das nicht: der Monat wird ohnehin aus dem Unterschrift-Datum
-- abgeleitet, und "datum" durfte der Mitarbeiter immer schon setzen.
--
-- Die Liste unten ist vollständig gegen das abgeglichen, was die beiden
-- Mitarbeiter-Ansichten (js/mitarbeiter.js und js/schein.js) beim Speichern
-- wirklich schreiben:
--   Unterschrift   -> datum, unterschrift, unterschrift_name, monat, signed_at,
--                     vorher_fotos, nachher_fotos
--   Fotos ändern   -> vorher_fotos, nachher_fotos
--   Material       -> material_*
-- Alles andere (Kunde, Adresse, Leistungen, Termin, interne Notiz, archiviert)
-- bleibt der Verwaltung vorbehalten und wird von der App auch nie geschrieben.
--
-- Das Skript darf beliebig oft laufen.
-- ===========================================================================

drop trigger if exists geko_schutz_scheine on scheine;
create trigger geko_schutz_scheine before update on scheine
  for each row execute function geko_nur_spalten(
    'unterschrift', 'unterschrift_name', 'signed_at', 'datum', 'monat',
    'vorher_fotos', 'nachher_fotos',
    'anhang', 'anhang_name', 'anhang_type', 'anhaenge',
    'material_erfasst', 'material_stunden',
    'material_graffiti_ex_spray', 'material_graffiti_gel', 'material_paint_cleaner',
    'material_streichen', 'material_hochdruck', 'material_sandstrahl', 'material_freitext');


-- ---------------------------------------------------------------------------
-- Kontrolle: "monat" muss in der Liste stehen.
-- ---------------------------------------------------------------------------
select t.tgname,
       (select string_agg(x, ', ')
          from unnest(regexp_split_to_array(
                 encode(t.tgargs, 'escape'), '\\000')) x where x <> '') as erlaubte_spalten
  from pg_trigger t
 where t.tgrelid = 'scheine'::regclass
   and t.tgname = 'geko_schutz_scheine';
