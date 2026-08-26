#!/bin/bash
# ============================================================================
# GEKO · Kommt jemand an fremde Lohnabrechnungen?
# ============================================================================
# Das hier ist KEINE Behauptung, sondern ein Versuch. Das Skript spielt genau
# das durch, was ein Mitarbeiter mit ein bisschen Ahnung probieren würde:
#
#   1. Ohne Anmeldung an die Dokumente kommen.
#   2. Als angemeldeter Mitarbeiter in den EIGENEN Ordner sehen.
#   3. Als derselbe Mitarbeiter in den Ordner eines KOLLEGEN sehen.
#   4. Sich einen Link auf die Datei eines Kollegen ausstellen lassen.
#
# Aufruf:   bash pruefe_lohn_zugriff.sh
#
# Du brauchst dafür: einen Mitarbeiter-Benutzernamen samt Passwort (nimm ein
# Testkonto) und die Mitarbeiter-Nummer eines Kollegen. Die Nummer steht in
# den Einstellungen beim jeweiligen Mitarbeiter, oder im SQL-Editor:
#     select id, name from glas_mitarbeiter order by name;
#
# Es wird nichts verändert. Nur gelesen - beziehungsweise versucht.
# ============================================================================

set -u
cd "$(dirname "$0")" || exit 1

URL=$(grep -o 'SUPABASE_URL = "[^"]*"' js/config.js | sed 's/.*= "//;s/"//')
ANON=$(grep -o 'SUPABASE_ANON_KEY = "[^"]*"' js/config.js | sed 's/.*= "//;s/"//')

if [ -z "$URL" ] || [ -z "$ANON" ]; then
  echo "Konnte js/config.js nicht lesen. Läuft das Skript im Bk--Ordner?"; exit 1
fi

echo "============================================================"
echo " GEKO · Lohnabrechnungen: Angriffstest"
echo "============================================================"
echo

# ---- Angaben einsammeln ----------------------------------------------------
read -r -p "Benutzername eines Mitarbeiters (Testkonto): " NUTZER
read -r -s -p "Dessen Passwort: " PASS; echo
read -r -p "Mitarbeiter-Nummer eines KOLLEGEN (fremder Ordner): " FREMD
echo

# Plausibilitaet: Mitarbeiter-Nummern sind sechsstellige Codes wie "SR9HF3".
# Wer hier etwas anderes eintippt, prueft einen Ordner, den es gar nicht gibt -
# und ein nicht existierender Ordner ist natuerlich leer. Das saehe nach einem
# bestandenen Test aus und waere keiner.
if ! echo "$FREMD" | grep -qE '^[A-Za-z0-9]{5,10}$'; then
  echo "⚠️  ACHTUNG: \"$FREMD\" sieht nicht nach einer Mitarbeiter-Nummer aus."
  echo "   Die sehen aus wie SR9HF3 - sechs Zeichen, Buchstaben und Ziffern."
  echo "   Mit einer erfundenen Nummer sind die Tests 4 und 5 WERTLOS:"
  echo "   ein Ordner, den es nicht gibt, ist immer leer."
  echo
  echo "   Die echten Nummern bekommst du im SQL-Editor mit:"
  echo "       select id, name from glas_mitarbeiter order by name;"
  echo
  read -r -p "   Trotzdem weitermachen? (j/n) " WEITER
  [ "$WEITER" = "j" ] || exit 1
  echo
fi

case "$NUTZER" in
  *@*) MAIL="$NUTZER" ;;
  *)   MAIL="${NUTZER}@ma.gekoclean.de" ;;
esac

liste_ordner() {   # $1 = Token, $2 = Ordner
  curl -s -X POST "$URL/storage/v1/object/list/lohn" \
    -H "apikey: $ANON" -H "Authorization: Bearer $1" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$2\",\"limit\":100}"
}

# ---- 1) Ohne Anmeldung -----------------------------------------------------
echo "── Test 1: ohne jede Anmeldung an die Dokumente"
A1=$(liste_ordner "$ANON" "")
if echo "$A1" | grep -q '"name"'; then
  echo "   ✗ DURCHGEKOMMEN - das wäre ein Notfall. Antwort:"; echo "     $A1"
else
  echo "   ✓ abgewiesen"
fi
echo

# ---- 2) Anmelden -----------------------------------------------------------
echo "── Test 2: als $NUTZER anmelden"
ANTWORT=$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$MAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$ANTWORT" | grep -o '"access_token":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//')

if [ -z "$TOKEN" ]; then
  echo "   ✗ Anmeldung fehlgeschlagen. Antwort:"; echo "     $ANTWORT"
  echo
  echo "   Ohne Anmeldung können die Tests 3 und 4 nicht laufen."
  echo "   Benutzername/Passwort prüfen und noch einmal starten."
  exit 1
fi
echo "   ✓ angemeldet"

# Eigene Mitarbeiter-Nummer holen
EIGEN=$(curl -s "$URL/rest/v1/glas_mitarbeiter?select=id" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  | grep -o '"id":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//')
echo "   eigene Mitarbeiter-Nummer: ${EIGEN:-(nicht gefunden)}"
echo

# ---- 3) Eigener Ordner (MUSS gehen) ---------------------------------------
echo "── Test 3: eigener Ordner - der muss lesbar sein"
if [ -n "$EIGEN" ]; then
  A3=$(liste_ordner "$TOKEN" "$EIGEN")
  ANZ=$(echo "$A3" | grep -o '"name"' | wc -l | tr -d ' ')
  echo "   → $ANZ eigene Datei(en) sichtbar  (0 ist in Ordnung, wenn noch keine hochgeladen wurde)"
else
  echo "   übersprungen - eigene Nummer nicht ermittelbar"
fi
echo

# ---- 4) Fremder Ordner (DARF NICHT gehen) ---------------------------------
echo "── Test 4: Ordner des Kollegen $FREMD - hier ist der Ernstfall"
A4=$(liste_ordner "$TOKEN" "$FREMD")
if echo "$A4" | grep -q '"name"'; then
  echo "   ✗✗✗ FREMDE DATEIEN SICHTBAR - SOFORT MELDEN:"
  echo "$A4" | head -c 500
else
  echo "   ✓ nichts sichtbar - abgewiesen"
fi
echo

# ---- 5) Link auf eine fremde Datei ----------------------------------------
echo "── Test 5: sich einen Link auf eine fremde Datei ausstellen lassen"
A5=$(curl -s -X POST "$URL/storage/v1/object/sign/lohn/$FREMD/beliebig.pdf" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"expiresIn":60}')
if echo "$A5" | grep -q '"signedURL"'; then
  echo "   ✗✗✗ LINK WURDE AUSGESTELLT - SOFORT MELDEN:"; echo "     $A5"
else
  echo "   ✓ verweigert"
fi
echo

echo "============================================================"
echo " Erwartet: Test 1, 4 und 5 abgewiesen, Test 3 zeigt die"
echo " eigenen Dateien."
echo
echo " WICHTIG fuer die Aussagekraft: Test 4 zaehlt nur, wenn im"
echo " Ordner des Kollegen wirklich ein Dokument liegt. Sonst"
echo " haben wir bewiesen, dass ein leerer Ordner leer ist."
echo " Also vorher bei einem Mitarbeiter ein PDF hochladen und"
echo " DESSEN Nummer hier angeben."
echo "============================================================"
