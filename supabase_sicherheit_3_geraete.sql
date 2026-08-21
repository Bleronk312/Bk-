-- ============================================================================
-- GEKO · Welches Gerät hängt an welchem Zugang?
-- ============================================================================
-- Bisher stand in der Übersicht nur eine Zahl ("2 Geräte"). Die sagt zu wenig:
-- Zwei Geräte können Diensthandy plus Büro-Rechner sein - völlig in Ordnung -
-- oder Diensthandy plus ein fremdes Handy, weil jemand seinen Zugang
-- weitergegeben hat. Das eine ist Alltag, das andere ist der Anfang eines
-- Problems, und ohne Namen sieht man den Unterschied nicht.
--
-- Die App trägt beim Einschalten der Benachrichtigungen eine grobe Bezeichnung
-- ein: "iPhone · App", "Mac · Browser", "Windows-PC · Browser".
--
-- Bewusst grob. Es geht darum, Geräte auseinanderhalten zu können, nicht
-- darum, Mitarbeiter zu vermessen. Eine genaue Gerätekennung wäre ein
-- Personendatensatz, den hier niemand braucht - und den man dann auch
-- schützen müsste.
--
-- Gefahrlos: eine zusätzliche Spalte, sonst nichts.
-- ============================================================================

alter table push_subscriptions add column if not exists geraet text;

-- Bestehende Anmeldungen kennen ihr Gerät noch nicht. Sie tragen es beim
-- nächsten App-Start von selbst nach (autoRenewPushSubscription läuft bei
-- jedem Öffnen). Bis dahin steht in der Übersicht "Gerät unbekannt".

-- Kontrolle: wie viele Anmeldungen kennen ihr Gerät schon?
select count(*) as anmeldungen,
       count(geraet) as mit_geraet,
       count(*) - count(geraet) as noch_offen
  from push_subscriptions;
