# Offen: fremde Bibliotheken kommen noch von außen

**Stand nach der Prüfung vom 21.08.2026. Kein Notfall, aber der größte
verbliebene Punkt.**

## Worum es geht

Die App lädt vier Bibliotheken von fremden Servern:

| Bibliothek | Woher | Wofür |
|---|---|---|
| supabase-js | cdn.jsdelivr.net | Datenbank & Anmeldung – **auf jeder Seite** |
| jspdf | cdnjs.cloudflare.com | PDF-Erzeugung |
| signature_pad | cdnjs.cloudflare.com | Unterschriftenfeld |
| leaflet | cdnjs.cloudflare.com | Karte bei den Check-ins |

Keine davon ist mit einer Prüfsumme abgesichert (`integrity`). Der Browser
nimmt also, was der fremde Server ihm gibt – ungeprüft.

**Was das bedeutet:** Wer einen dieser Server unter Kontrolle bringt, führt
seinen Code *in* der angemeldeten GEKO-App aus. Nicht daneben – darin. Mit
allem, was der gerade Angemeldete darf. Beim Ober-Admin also: Kundendaten,
Lohnabrechnungen, Zugänge.

**Wie wahrscheinlich?** Gering. Cloudflare und jsDelivr sind große, gut
betreute Dienste. Aber es ist die Art Risiko, gegen die man sich im eigenen
Code nicht wehren kann – deshalb steht es hier.

`pdf.js` lief bis v213 ebenfalls über cdnjs, obwohl die Datei längst unter
`vendor/pdfjs/` lag. Das ist erledigt: der Dokumenten-Viewer nimmt jetzt die
lokale Kopie und geht dadurch auch ohne Empfang auf.

## Die saubere Lösung: alles ins eigene Haus

Herunterladen und mitliefern, wie bei pdf.js. Dann gibt es keinen fremden
Server mehr, der etwas ausliefern könnte – und die App startet schneller und
funktioniert offline vollständig.

**Auf dem Mac ausführen** (dort ist Internet):

```bash
cd ~/Desktop/Bk-
mkdir -p vendor/lib

curl -L -o vendor/lib/supabase-js@2.min.js  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
curl -L -o vendor/lib/jspdf.umd.min.js      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
curl -L -o vendor/lib/signature_pad.umd.min.js "https://cdnjs.cloudflare.com/ajax/libs/signature_pad/4.1.7/signature_pad.umd.min.js"
curl -L -o vendor/lib/leaflet.min.js        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"

ls -la vendor/lib/
```

Alle vier Dateien müssen eine sinnvolle Größe haben (nicht 0, nicht ein paar
hundert Byte – das wäre eine Fehlerseite statt der Bibliothek).

Danach Bescheid geben: Die Verweise in den HTML-Dateien und im
Offline-Vorrat umzustellen ist dann Fleißarbeit, die ich übernehme.

### Ein Haken, ehrlich gesagt

`supabase-js@2` ist eine *mitwachsende* Adresse – sie liefert immer die
neueste 2er-Fassung, inklusive Fehlerbehebungen. Lokal mitgeliefert friert
sie ein. Das ist sicherheitlich besser (niemand kann sie unbemerkt
austauschen), heißt aber: **einmal im Jahr nachziehen.** Sonst läuft die App
irgendwann auf einer Fassung, die selbst Lücken hat.

Wer das nicht pflegen will, ist mit dem CDN besser bedient. Beides ist
vertretbar – nur beides gleichzeitig zu glauben nicht.

## Warum es keine Content-Security-Policy gibt

Eine CSP wäre der zweite Riegel: Sie sagt dem Browser, von welchen Adressen
er überhaupt Code annehmen darf. Die App arbeitet aber durchgehend mit
`onclick`-Attributen und eingebetteten Skripten. Eine strenge Regel würde die
halbe Oberfläche lahmlegen, eine lasche wäre Selbstbetrug.

Das gehört vorbereitet und durchgetestet – nicht nebenbei eingeschaltet. Die
harmlosen Kopfzeilen (kein Einbetten, kein Datei-Raten, sparsame Referrer,
begrenzte Geräterechte) stehen seit v213 in `_headers` und sind aktiv.
