-- ============================================================================
-- GEKO · Geräte wirklich abmelden
-- ============================================================================
-- WAS WAR DAS PROBLEM?
-- "Abmelden" bei einem Gerät hat bisher nur die Benachrichtigungs-Anmeldung
-- entfernt. Wer auf dem Gerät angemeldet war, blieb angemeldet - man kam
-- einfach weiter rein. Das ist genau die Sicherheit, die man zu haben glaubt
-- und nicht hat.
--
-- WIE ES JETZT GEHT
-- Diese Spalte hält den Zeitpunkt fest, ab dem alle älteren Anmeldungen
-- ungültig sind. Die App vergleicht bei jedem Start, wann sie sich angemeldet
-- hat: liegt das davor, meldet sie sich selbst ab und verlangt eine neue
-- Anmeldung.
--
-- ----------------------------------------------------------------------------
-- WAS DAS KANN UND WAS NICHT (bitte lesen)
--
-- Es wirkt IMMER FÜR ALLE Geräte einer Person, nie für ein einzelnes. Eine
-- einzelne Anmeldung gezielt zu beenden, geht mit Supabase nicht - der Server
-- führt keine Liste "welches Handy hat welche Anmeldung". Die Oberfläche sagt
-- das jetzt auch so, statt es zu verschweigen.
--
-- Es wirkt, sobald das Gerät das nächste Mal die App öffnet und Netz hat. Ein
-- Handy, das aus bleibt, merkt nichts davon.
--
-- Für den harten Fall - gestohlenes Handy, jemand ist im Streit gegangen -
-- bleibt der sichere Weg unverändert: SPERREN. Das entscheidet der Server bei
-- jeder Anfrage neu, daran führt kein Weg vorbei.
-- ============================================================================

alter table glas_mitarbeiter add column if not exists abmelden_ab timestamptz;

-- Gesetzt wird die Spalte ausschließlich vom Server (Edge Function mit
-- Service-Rolle). Der Wächter auf der Tabelle lässt Mitarbeiter ohnehin nur an
-- pw_muss_wechsel, pw_selbst_gesetzt und zuletzt_gesehen - abmelden_ab steht
-- bewusst NICHT in dieser Liste, sonst könnte sich jeder selbst wieder
-- freischalten.

-- Kontrolle: Spalte da, und niemand hat sie versehentlich gesetzt.
select column_name, data_type
  from information_schema.columns
 where table_name = 'glas_mitarbeiter' and column_name = 'abmelden_ab';

select count(*) filter (where abmelden_ab is not null) as mit_abmeldung
  from glas_mitarbeiter;
