-- ============================================================================
-- GEKO · Arbeitszeiten sind Privatsache
-- ============================================================================
-- WAS WAR DAS PROBLEM?
-- Die Regel für checkin_schichten lautete:
--
--     for select to authenticated using (geko_darf('checkin'))
--
-- Also: Jeder mit Check-in-Freischaltung konnte die Schichten ALLER Kollegen
-- lesen - wann wer angefangen und aufgehört hat, Tag für Tag. Nicht über die
-- Oberfläche, aber mit dem öffentlichen Schlüssel und drei Zeilen Code.
--
-- Das ist kein Einbruchsweg, sondern ein Datenschutz-Problem - und in
-- Deutschland kein kleines: Arbeitszeiten sind personenbezogene Daten, und
-- wer sie ohne Not allen zugänglich macht, hat spätestens beim ersten Ärger
-- ein Problem.
--
-- Die Mitarbeiter-App fragt ohnehin immer nur die eigenen Schichten ab
-- (.eq("mitarbeiter_id", ciUser.id) in js/checkins-ma.js). Die Einschränkung
-- kostet also keine einzige Funktion.
--
-- Die Verwaltung sieht weiterhin alles - dafür gibt es die Admin-Regel.
-- ============================================================================

drop policy if exists "geko_ma_ci_schichten_lesen" on checkin_schichten;
create policy "geko_ma_ci_schichten_lesen" on checkin_schichten
  for select to authenticated
  using (geko_darf('checkin') and mitarbeiter_id = geko_ma_id());


-- ---------------------------------------------------------------------------
-- Warum checkin_logs ABSICHTLICH offen bleibt
-- ---------------------------------------------------------------------------
-- Bei den Check-in-Buchungen (checkin_logs) geht das NICHT genauso. Ein
-- Rundgang ist gemeinsame Arbeit: Hakt ein Kollege einen Punkt ab, ist der
-- für alle erledigt. Würde jeder nur seine eigenen Buchungen sehen, stünde im
-- Kalender wieder "0/5 erledigt", obwohl der Rundgang gelaufen ist - genau der
-- Fehler, den wir vor ein paar Tagen behoben haben.
--
-- Sichtbar ist damit für Kollegen: welcher Punkt wann von wem abgehakt wurde.
-- Das ist die Information, die die gemeinsame Arbeit braucht. Die
-- Arbeitszeiten - Beginn und Ende der Schicht - sind ab jetzt privat.


-- Kontrolle: die Schichten-Regel muss den Mitarbeiter-Vergleich enthalten.
select policyname, cmd, qual
  from pg_policies
 where tablename = 'checkin_schichten'
 order by policyname;
