-- ============================================================================
-- GEKO · Welche Geräte hängen an einem Zugang?
-- ============================================================================
-- Reine ANZEIGE für die Verwaltung. Bisher stand dort nur eine Zahl ("2
-- Geräte"). Die sagt zu wenig: Zwei Geräte können Diensthandy plus
-- Büro-Rechner sein - völlig normal - oder Diensthandy plus ein fremdes Handy,
-- weil jemand seinen Zugang weitergegeben hat. Ohne Namen sieht man den
-- Unterschied nicht.
--
-- ZWEI SPALTEN
--
-- "geraet"  Klartext-Bezeichnung, die die App beim Einschalten der
--           Benachrichtigungen einträgt: "iPhone · App", "Mac · Safari",
--           "Windows-PC · Chrome".
--
--           Das genaue Modell ("iPhone 15 Pro") lässt sich NICHT ermitteln.
--           Apple und Google geben es absichtlich nicht mehr heraus, weil man
--           Menschen damit quer durchs Netz wiedererkennen könnte. Was geht,
--           ist Geräteart + Browser + ob die App vom Home-Bildschirm läuft -
--           und das reicht, um Geräte auseinanderzuhalten.
--
-- "auth_user_id"  An welchem KONTO hängt das Gerät.
--           Bisher wurde nur die Mitarbeiter-Nummer mitgeschrieben. Die haben
--           aber nur Mitarbeiter - Bürokräfte und der Ober-Admin haben gar
--           keinen Mitarbeiter-Datensatz. Deren Geräte waren deshalb nirgends
--           zuzuordnen und tauchten in der Übersicht überhaupt nicht auf.
--           Über die Konto-Nummer klappt es für beide Arten von Zugang.
--
-- Gefahrlos: zwei zusätzliche Spalten, sonst nichts.
-- ============================================================================

alter table push_subscriptions add column if not exists geraet text;
alter table push_subscriptions add column if not exists auth_user_id uuid;

create index if not exists idx_push_subscriptions_konto
  on push_subscriptions(auth_user_id);

-- Bestehende Anmeldungen kennen weder Gerät noch Konto. Sie tragen beides beim
-- nächsten App-Start von selbst nach (autoRenewPushSubscription läuft bei jedem
-- Öffnen). Bis dahin steht in der Übersicht "Gerät noch unbekannt" - das ist
-- ehrlicher als eine erfundene Angabe.

-- Was schon nachgetragen ist:
select count(*)                        as anmeldungen,
       count(geraet)                   as mit_geraetenamen,
       count(auth_user_id)             as mit_konto,
       count(distinct endpoint)        as tatsaechliche_geraete
  from push_subscriptions;
