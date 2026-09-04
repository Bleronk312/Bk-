# CLAUDE.md — Projektgedächtnis der GEKO App

Diese Datei wird von Claude Code bei jedem Session-Start gelesen. Sie fasst
zusammen, was in Monaten Arbeit (300+ Commits) an Wissen entstanden ist.
**Bei Änderungen an Architektur oder Regeln: diese Datei mitpflegen.**

## Was ist das hier?

Die interne App-Suite von **GEKO Clean** (Glas- und Gebäudereinigung, Bonn),
live unter **https://gekoapp.com**. Eine Sammlung von PWAs für den Betrieb:

| Bereich | Verwaltung | Mitarbeiter |
|---|---|---|
| Glasreinigung (Touren, Abnahmescheine, Kalender) | `glas-admin.html` | `glas-mitarbeiter.html` |
| Graffiti-Entfernung (Abnahmescheine) | `graffiti.html` | `mitarbeiter.html`, `schein.html` |
| Check-ins / GPS-Rundgänge ("Wächterkontrollsystem") | `checkins-admin.html` | `checkins-ma.html` |
| GEKO One (EINE App für Mitarbeiter: Touren, Kalender, Urlaub, Dokumente, Lager) | — | `meine.html` |
| Hub der Verwaltung (Einstieg zu allen Abteilungen) | `hub.html` | — |
| Kalender der Verwaltung (eigene Home-Bildschirm-App) | `kalender.html` | — |
| Zentrale Einstellungen (Mitarbeiter, Zugänge, Benachrichtigungen) | `einstellungen.html` | — |

Kurz-Adressen (`_redirects`, Reihenfolge zählt, `200!` erzwingt):
`/` → GEKO One (`meine.html`, die Adresse für Mitarbeiter) · `/admin` → Hub ·
`/kalender` → Kalender-App · `/app` → Installations-Anleitung · `/start` → Alt-Link auf GEKO One.
Bewusst KEINE eigenen Kurz-Adressen für einzelne Abteilungen.

## ⚠️ Nicht verhandelbare Regeln

1. **`test` ist der PRODUKTIONS-Branch.** Netlify (Projekt `sunny-platypus-bce4eb`)
   deployt jeden Push auf `test` sofort nach gekoapp.com. Trotz des Namens:
   niemals löschen, niemals umbenennen, nichts Ungetestetes draufpushen.
   Einen `main`-Branch gibt es nicht; Default-Branch auf GitHub ist `test`.
2. **Es darf nie etwas verloren gehen.** Unterschriebene Abnahmescheine sind
   Belege gegenüber Kunden/Städten. Korrekturen daran nur mit Backup-Tabelle
   im selben SQL (Vorbild: `supabase_fix_letzte_reinigung.sql`, FH-Südwestfalen-Fix).
3. **Seed-SQLs enthalten nur INSERTs** (und ggf. Kontroll-SELECTs) — niemals
   UPDATE/DELETE auf Bestandsdaten. Vorbild: `supabase_seed_*.sql`.
4. **Wächter-Spaltenlisten pflegen** (siehe unten). Jede neue Spalte, die eine
   Mitarbeiter-App schreibt, MUSS in die Trigger-Liste — sonst Zeitbombe wie
   der `monat`-Bug am Monatswechsel (Commit vom 01.09.2026).
5. **Kein Framework, kein Build-Schritt.** Vanilla JS + HTML + CSS, direkt
   deploybar. Fremde Bibliotheken liegen unter `vendor/` im eigenen Haus.
6. **Versionsstempel bei jedem Release bumpen:** `GEKO_CACHE = "geko-cache-vNNN"`
   in `sw.js` UND die `?v=NNN`-Query-Strings in den HTML-Dateien (aktuell v223).
   Sonst hängen Geräte im alten Cache.
7. Datenbank-Migrationen laufen **manuell im Supabase SQL Editor** — es gibt
   keine automatische Migrations-Pipeline. Jede Änderung als neue, gefahrlos
   komplett ausführbare `supabase_*.sql`-Datei ins Repo.

## Stack & Infrastruktur

- **Frontend:** Vanilla JS, eine Datei pro App unter `js/`. Gemeinsames in
  `js/app-shared.js`, `js/glas-shared.js`, `js/checkins-shared.js`.
- **Backend:** Supabase, Projekt `tjeheehmaefrqutbjmxn` (URL/anon-Key in
  `js/config.js`). Edge Functions unter `supabase_edge_functions/`
  (`send-push`, `daily-reminders`, `send-schein` (E-Mail via Resend),
  `benutzer-verwalten`, `checkin-reminders`, `lager-erinnerung`) — werden per
  Copy-Paste im Supabase-Dashboard deployt, laufen mit `service_role`
  (umgehen RLS).
- **Hosting:** Netlify, Deploy = Git-Push auf `test`. `_headers` setzt
  Sicherheits-Kopfzeilen (bewusst OHNE Content-Security-Policy — die App nutzt
  onclick-Attribute; CSP nur nach sauberer Vorbereitung einführen).
- **PWA:** Ein Service Worker (`sw.js`): eigene Dateien network-first (nie
  veraltete Version nach Deploy), `vendor/` cache-first, Supabase-Daten NIE
  aus dem Cache. Je App ein eigenes Manifest (`manifest-*.json`) + Icon.
- **Nachbar-Systeme:** Hub verlinkt auf `ausschreibungen3.netlify.app`
  (Ausschreibungs-Plattform, eigenes Repo) und `lively-smakager-c9ba91.netlify.app`
  (Fahrzeuge/Fuhrpark, eigenes Repo). Nicht Teil dieses Repos.

## Anmeldung & Sicherheit (Stand: „echte Anmeldung", August 2026)

- **Supabase Auth** statt Passwort-Prüfung im Browser. Mitarbeiter tippen nur
  ihren Benutzernamen; `js/geko-auth.js` hängt `@ma.gekoclean.de` an
  (muss keine Mails empfangen). Sitzung bleibt dauerhaft (`persistSession`,
  storageKey `geko_auth`) und gilt domainweit für alle GEKO-Seiten.
- **RLS ist scharf** (`supabase_auth_4_rls.sql`): anon-Key hat KEINEN
  Tabellenzugriff. Rollenlogik: `geko_ist_admin()`, `geko_darf(bereich)` —
  Glas ist „an, außer ausdrücklich aus", Check-ins/Graffiti/Lager müssen
  ausdrücklich freigeschaltet sein (`zugang_*`-Spalten in `glas_mitarbeiter`).
  Notbremse: `supabase_auth_4_rueckzug.sql`. Ober-Admin: `supabase_auth_5_oberadmin.sql`.
- **Wächter-Trigger `geko_nur_spalten(...)`:** Mitarbeiter dürfen an einer
  Zeile nur die als Trigger-Argumente aufgezählten Spalten ändern; Admins sind
  ausgenommen. Der Trigger schlägt nur bei ECHTER Änderung an — deshalb fallen
  fehlende Spalten erst später auf! Abgeglichene Schreibzugriffe der MA-Apps
  (Stand 09/2026): Graffiti unterschreiben: `datum, unterschrift,
  unterschrift_name, monat, signed_at` + Fotos; Fotos/Material:
  `vorher_/nachher_fotos, material_*`; Glas unterschreiben (`glasSignStop`):
  `name, datum, unterschrift, status, signed_at, zusatz, positionen,
  erfasst_von`; Passwort: `pw_selbst_gesetzt, pw_muss_wechsel`; sonstiges:
  `gesehen_am, bestaetigt, zuletzt_gesehen`.
- **PIN-Sperren** zusätzlich vor Glas-Admin, Graffiti-Admin, Check-ins-Admin
  (einmalig pro Gerät).
- `supabase_sicherheit_pruefen.sql` = „Sicherheits-Zeugnis": eine Abfrage, die
  den ganzen Sicherheitsstand nachweist. Nach Sicherheitsänderungen ausführen.
- `pruefe_lohn_zugriff.sh` = Angriffstest für Lohn-/Dokumenten-Zugriffe.
- **Offener Punkt** (`OFFEN_fremde_bibliotheken.md`): supabase-js, jspdf,
  signature_pad, leaflet kommen noch ohne integrity-Hash vom CDN — größter
  verbliebener Punkt, Lösung: unter `vendor/` selbst hosten (wie pdf.js).

## Fachliche Eckpunkte (teuer erarbeitet)

- **Zwei Firmen:** Kunden und Positionen sind nach GEKO Clean vs. **Dietrich**
  (Generalauftraggeber) getrennt. Dietrich: Haupt-Kd.-Nr. am Kunden +
  Objekt-Nr. am Objekt (kombiniert mit Leerzeichen), eigene **LFD-Nr.** pro
  Abnahmeschein, eigene PDF-Vorlage (automatisch).
- **Fälligkeitslogik Glas:** Intervalle je Position, `faelligkeit_override`,
  „geplant" zählt nicht als fällig, Fälligkeit wandert nach Unterschrift
  weiter (RLS-Fix 31.08.), feste Monate nie rückwirkend überfällig,
  Fälligkeit einen Monat früher für Planungs-Vorlauf, Jahresvorschau mit
  ±2 Monaten Toleranz.
- **Schein-Monat:** „Auszuführende Arbeiten Monat" folgt dem UNTERSCHRIFT-Datum,
  nicht dem Anlage-/Tour-Datum.
- **PDF:** jspdf, Umlaute über eigene Fonts (`pdf-fonts.js`), Bilder werden
  komprimiert (~95 % kleiner), Mehrblatt-Scheine, Dateiname `LN_kdnr_strasse`.
- **Offline:** MA-App öffnet ohne Empfang, Unterschriften landen in einer
  Warteschlange und werden nachgereicht.
- **iOS-PWA ist heikel:** Home-Bildschirm-Installation pro App nötig (Push nur
  so, iOS 16.4+), Statusleisten/Safe-Area-Höhen wurden am Gerät nachgemessen
  (v44–v53), Installations-Adresse muss zur Manifest-Adresse passen.
  Pull-to-Refresh ist auf MA-Seiten ENTFERNT (kaperte den Unterschrift-Canvas
  auf Android/Xiaomi) — stattdessen „Aktualisieren"-Knopf.
- **Sprachen:** Mitarbeiter-Apps Deutsch/Albanisch (`js/ma-i18n.js`).
- **Fehler-Flugschreiber:** `js/fehler.js` zeichnet Fehler auf, Ansicht in
  `diagnose.html`.

## Branch-Landschaft

- `test` — Produktion (siehe oben). Historie mit sehr ausführlichen deutschen
  Commit-Botschaften: **die Commit-Historie ist die Projekt-Doku**, bei
  Warum-Fragen zuerst `git log` durchsuchen.
- `backup/stand-vor-geko-one` — eingefrorener Live-Stand v131 (13.08.2026),
  bevor GEKO One kam. `backup/stabil-v53` — Stand Juli 2026. Nicht anfassen.
- `claude/kunden-anlegen-eipzya` — Seiten-Branch nur mit Seed-SQLs
  (Meckenheim, Brühl, Montabaur, FH Südwestfalen, Dietrich Tour 215);
  basiert auf altem Juli-Stand, NICHT auf test mergen ohne Prüfung.
- `claude/geko-one` — historischer Arbeits-Branch des GEKO-One-Umbaus.

## Arbeitsweise

- Commit-Botschaften auf Deutsch, mit ausführlicher Begründung im Body
  (warum, nicht nur was; gern mit dem Bedienungs-Effekt für die Mitarbeiter).
  Release-Commits tragen den Versionsstempel `(vNNN)` im Titel.
- Änderungen, die SQL brauchen, bekommen ihre eigene `supabase_*.sql`-Datei
  mit erklärendem Kopf-Kommentar; der Nutzer führt sie selbst im SQL Editor aus
  — im Zweifel im Chat ausdrücklich darauf hinweisen, WAS auszuführen ist.
- Nach Sicherheits- oder Wächter-Änderungen: Schreibzugriffe der MA-Apps
  (`js/mitarbeiter.js`, `js/schein.js`, `js/glas-mitarbeiter.js`,
  `js/meine.js`) gegen die Trigger-Listen abgleichen.
- Die App wird von echten Mitarbeitern auf iPhones/Androids im Feld benutzt.
  Stabilität schlägt Eleganz; UI-Umbauten wurden mehrfach zurückgenommen, wenn
  sie sich am Handy nicht bewährt haben — im Zweifel klein und rückholbar ändern.
