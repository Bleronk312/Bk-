# Abnahmeschein-App – GEKO

## Jetzt einzurichten: Push-Benachrichtigungen

Das ist der einzige Teil, der bei dir gerade noch offen ist. Du brauchst dafür nur den Browser, kein Terminal.

**Was du bekommst:**
- **Admin:** Push, wenn ein Mitarbeiter einen Schein unterschrieben hat, sowie jeden Morgen um 8 Uhr eine Übersicht aller Termine des Tages.
- **Mitarbeiter:** Push, wenn ein neuer Schein angelegt wurde, sowie dieselbe 8-Uhr-Erinnerung.

**Schritt 1 – Tabelle anlegen:** Supabase → SQL Editor → Inhalt von `supabase_add_push.sql` einfügen → Run.

**Schritt 2 – Zwei Edge Functions anlegen:**
1. Supabase-Dashboard → links **"Edge Functions"** → "Deploy a new function"
2. Name `send-push` → Inhalt von `supabase_edge_functions/send-push/index.ts` hineinkopieren → Deploy
3. Nochmal neu: Name `daily-reminders` → Inhalt von `supabase_edge_functions/daily-reminders/index.ts` hineinkopieren → Deploy
4. Falls nach "Verify JWT" gefragt wird: **ausschalten**.

**Schritt 3 – Geheime Schlüssel hinterlegen** (bei den Edge Function-Einstellungen unter "Secrets"):
```
VAPID_PUBLIC_KEY = BH5svn75k_QSVlXToFm2CUppfk7vLY4Fdr34pxrFxKN9zSUdfOxJJDtTOg_ZT9WD-MfPMUPSTQJHI1jCOPN9dzM
VAPID_PRIVATE_KEY = nLHBAc73y-Q2M8jKrNFefTseZ55EIp2coXVQ9C2L168
```

**Schritt 4 – Tägliche 8-Uhr-Erinnerung:** In `supabase_cron_setup.sql` `DEIN-PROJEKT` und `DEIN-ANON-KEY` durch deine echten Werte ersetzen → in Supabase SQL Editor einfügen → Run.

**Schritt 5 – Aktivieren:** Nach dem Hochladen oben im blauen Bereich auf **"🔔 Benachrichtigungen"** tippen (auf admin.html und mitarbeiter.html getrennt) → iPhone-Erlaubnis bestätigen.

*Funktioniert nur, wenn die Seite vorher über "Zum Home-Bildschirm" hinzugefügt wurde und iOS 16.4+ läuft.*

---

## Die üblichen zwei Schritte (kennst du schon)

1. Bei jeder neuen Version: `js/config.js` mit deinen echten Werten füllen (SUPABASE_URL, SUPABASE_ANON_KEY)
2. Ordner per Drag & Drop bei Netlify hochladen

---

## Zwei Wege für Mitarbeiter

- **`mitarbeiter.html`** – feste Adresse für alle, zeigt automatisch alle zugewiesenen Scheine
- **`schein.html?id=CODE`** – Link zu einem einzelnen Schein (über "Link kopieren", falls mal gebraucht)

---

## Sicherheit

Admin- und Mitarbeiter-Bereich sind ohne Passwort erreichbar – wer den Link kennt, kommt rein (im Admin-Bereich auch mit voller Bearbeiten-/Löschen-Berechtigung). Links nur an Personen weitergeben, die das auch dürfen.

---

## Bisherige Updates (zur Erinnerung, nichts zu tun)

- Kunden- & Kategorien-Verwaltung, interne Notizen, Foto-Anhänge (komprimiert)
- Vorher-/Nachher-Fotos mit Zusammenfassung als PDF (teilen/speichern)
- Status-Eckfahnen (offen/erledigt), Wochen-Gruppen, Archiv-Reiter im Admin-Bereich
- Termine + eigener Kalender-Bereich (Mitarbeiter)
- Material-/Zeit-Erfassung nach der Unterschrift (Kategorien: Graffitientfernung, Sonderreinigung, Grundreinigung bekommen die volle Abfrage, alle anderen nur Stunden + Freitext)
- Statistik-Reiter, Suche, App-Icon für den Home-Bildschirm
- Diverse Detail-Verbesserungen: Routen-Buttons (Google Maps/Waze/Apple Karten), Anrufen-Button, Zurück-Wischen, Animationen, Push-Benachrichtigungen (siehe oben)

---

## Dateien in diesem Ordner

```
admin.html              Verwaltungsoberfläche
mitarbeiter.html        Feste Übersichtsseite für Mitarbeiter
schein.html             Einzelner Schein über individuellen Link
index.html              Leitet zu admin.html weiter
sw.js                   Service Worker für Push-Benachrichtigungen

supabase.sql                Komplettes Setup für eine NEUE Installation
supabase_update.sql         Migration: Kunden/Kategorien/Anhang
supabase_add_notiz.sql      Migration: Interne Notiz
supabase_add_fotos.sql      Migration: Vorher-/Nachher-Fotos
supabase_update2.sql        Migration: Termin, Archivierung
supabase_add_material.sql   Migration: Material-/Zeit-Erfassung
supabase_add_push.sql       Migration: Push-Benachrichtigungen (Tabelle)
supabase_cron_setup.sql     Tägliche 8-Uhr-Erinnerung einrichten
supabase_edge_functions/    Code für die zwei Push-Server-Funktionen

js/config.js             Eigene Zugangsdaten eintragen
js/admin.js              Logik Admin-Bereich
js/mitarbeiter.js        Logik Mitarbeiter-Übersicht
js/schein.js             Logik Einzel-Schein-Ansicht
js/push.js               Push-Benachrichtigungen (Anmeldung)
js/pdf-template.js       PDF-Erzeugung im GEKO-Layout
js/supabase-client.js    Datenbank-Verbindung
css/style.css            Aussehen der App
```
