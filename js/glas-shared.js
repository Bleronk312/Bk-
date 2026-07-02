// Gemeinsame Hilfsfunktionen für das Glasreinigungs-Modul:
// Geocoding (OpenStreetMap Nominatim, kostenlos, kein API-Key) + Routenoptimierung.

// Basis-Standort (Startpunkt der Touren). Bei Bedarf anpassen (aktuell Bonn-Zentrum).
const GLAS_BASE = { lat: 50.7374, lng: 7.0982 };

function glasHaversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function glasGeocodeRaw(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// Versucht die volle Adresse; findet Nominatim nichts, wird die Anfrage schrittweise
// vereinfacht (z.B. nur Straße+Ort, dann nur PLZ+Ort), damit wenigstens eine ungefähre
// Position als Vorschlag zurückkommt, statt komplett zu scheitern.
async function glasGeocode(address) {
  const full = address.includes("Bochum") || /\d{4,5}/.test(address) ? address : `${address}, Deutschland`;
  const attempts = [full];

  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) attempts.push(parts.slice(-2).join(", ") + ", Deutschland"); // z.B. "44793 Bochum"
  if (parts.length > 1) attempts.push(parts[parts.length - 1] + ", Deutschland"); // nur Ort/PLZ

  let approximate = false;
  for (let i = 0; i < attempts.length; i++) {
    const result = await glasGeocodeRaw(attempts[i]);
    if (result) {
      if (i > 0) approximate = true;
      return { lat: result.lat, lng: result.lng, approximate, suggestion: result.display };
    }
    if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error("Adresse nicht gefunden: " + address);
}

// stops: Array von Objekten mit .lat/.lng (z.B. glas_objekte-Zeilen).
// Stopps ohne Koordinaten (Geocoding fehlgeschlagen) werden ans Ende gehängt,
// statt die Berechnung abzubrechen.
function glasOptimizeRoute(stops) {
  const withCoords = stops.filter((s) => s.lat && s.lng);
  const withoutCoords = stops.filter((s) => !s.lat || !s.lng);

  const remaining = [...withCoords];
  const ordered = [];
  let current = GLAS_BASE;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, idx) => {
      const d = glasHaversineKm(current, s);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = next;
  }
  return [...ordered, ...withoutCoords];
}

/* ---------------- Fälligkeits-Berechnung (Planungs-System) ---------------- */

function glasTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function glasAddDaysIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Nächstes Datum aus einer festen Monatsliste (z.B. "3,6,9,12").
// Ohne letzte Reinigung: nächster Listen-Monat ab heute (inklusive des aktuellen Monats).
// Mit letzter Reinigung: nächster Listen-Monat STRIKT NACH dem Monat der letzten Reinigung -
// sonst bliebe eine Position im selben Monat für immer "überfällig", obwohl sie gerade erst
// erledigt und unterschrieben wurde.
function glasNaechsterFesterMonat(feste_monate, letzteReinigungIso) {
  const monate = String(feste_monate || "")
    .split(",")
    .map((m) => parseInt(m.trim(), 10))
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b);
  if (!monate.length) return null;

  let jahr, minMonat;
  if (letzteReinigungIso) {
    const d = new Date(letzteReinigungIso + "T00:00:00");
    jahr = d.getFullYear();
    minMonat = d.getMonth() + 2; // erst der Monat NACH der letzten Reinigung zählt wieder
  } else {
    const heute = new Date(glasTodayIso() + "T00:00:00");
    jahr = heute.getFullYear();
    minMonat = heute.getMonth() + 1;
  }

  let monat = monate.find((m) => m >= minMonat);
  if (monat === undefined) { monat = monate[0]; jahr++; }
  return `${jahr}-${String(monat).padStart(2, "0")}-01`;
}

// Berechnet die Fälligkeit einer Position. Rückgabe: ISO-Datum oder null (kein Intervall
// hinterlegt = rein manuell, taucht nirgends in Fällig-Listen auf).
function glasBerechneFaelligkeit(pos) {
  if (pos.faelligkeit_override) return pos.faelligkeit_override;
  if (pos.intervall_typ === "rollierend") {
    const wochen = parseInt(pos.intervall_wochen, 10);
    if (!wochen) return null;
    if (!pos.letzte_reinigung) return glasTodayIso(); // noch nie gereinigt -> sofort fällig
    return glasAddDaysIso(pos.letzte_reinigung, wochen * 7);
  }
  if (pos.intervall_typ === "feste_monate") {
    return glasNaechsterFesterMonat(pos.feste_monate, pos.letzte_reinigung || null);
  }
  return null;
}

// Liefert Fälligkeit + Status ('ueberfaellig' | 'bald' | 'geplant' | null) + Tage-Differenz.
function glasFaelligkeitStatus(pos) {
  const faelligkeit = glasBerechneFaelligkeit(pos);
  if (!faelligkeit) return { faelligkeit: null, status: null, tage: null };
  const today = glasTodayIso();
  const tage = Math.round((new Date(faelligkeit) - new Date(today)) / 86400000);
  const status = tage < 0 ? "ueberfaellig" : tage <= 14 ? "bald" : "geplant";
  return { faelligkeit, status, tage };
}

function glasIntervallLabel(pos) {
  if (pos.intervall_typ === "rollierend") return `alle ${pos.intervall_wochen || "?"} Wochen`;
  if (pos.intervall_typ === "feste_monate") {
    const namen = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return String(pos.feste_monate || "")
      .split(",")
      .map((m) => namen[parseInt(m.trim(), 10) - 1])
      .filter(Boolean)
      .join(", ");
  }
  return "Kein Intervall";
}

/* ---------------- Unterschreiben (von Mitarbeiter- UND Admin-Seite genutzt) ---------------- */

// Markiert einen Stopp als unterschrieben und setzt "zuletzt gereinigt" nur für die
// Positionen zurück, die tatsächlich auf diesem Schein enthalten waren (nicht automatisch
// für alle Positionen des Objekts) - inkl. Zurücksetzen einer evtl. manuellen Verschiebung.
async function glasSignStop(stopId, positionenJson, name, datum, unterschrift) {
  const payload = { name, datum, unterschrift, status: "erledigt", signed_at: new Date().toISOString() };
  const { error } = await sb.from("glas_stopps").update(payload).eq("id", stopId);
  if (error) return { error };

  try {
    const positionen = JSON.parse(positionenJson || "[]");
    const ids = positionen.map((p) => p.id).filter(Boolean);
    if (ids.length) {
      await sb.from("glas_objekt_positionen").update({ letzte_reinigung: datum, faelligkeit_override: null }).in("id", ids);
    }
  } catch (e) { /* kein/ungültiges JSON - Objekt ohne Intervall-Tracking, kein Problem */ }

  return { error: null, payload };
}

/* ---------------- Wochen-Layout für die TimeTree-artige Kalenderansicht ---------------- */

function glasIsoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Liefert ein Array von Wochen (je 7 ISO-Datumsstrings, Montag-Sonntag), die den Bereich
// von "vonMonat" bis "bisMonat" (inklusive, {year, month} mit month 0-11) komplett abdecken,
// aufgerundet auf volle Wochen.
function glasWeeksInRange(vonMonat, bisMonat) {
  const start = new Date(vonMonat.year, vonMonat.month, 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // zurück auf den Montag
  const endMonat = new Date(bisMonat.year, bisMonat.month + 1, 0); // letzter Tag des Bis-Monats
  const weeks = [];
  let cur = new Date(start);
  while (cur <= endMonat) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(glasIsoFromDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

// Greedy Intervall-Zuordnung: verteilt Touren, die in dieser Woche sichtbar sind, auf möglichst
// wenige "Zeilen" (Lanes), ohne dass sich zwei Touren in derselben Zeile überschneiden.
function glasAssignLanes(touren, weekDays) {
  const items = [];
  touren.forEach((t) => {
    const startCol = weekDays.findIndex((d) => d >= t.datum && d <= (t.datum_bis || t.datum));
    if (startCol === -1) return;
    let endCol = startCol;
    for (let i = weekDays.length - 1; i > startCol; i--) {
      if (weekDays[i] <= (t.datum_bis || t.datum) && weekDays[i] >= t.datum) { endCol = i; break; }
    }
    items.push({ tour: t, startCol, endCol });
  });
  items.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

  const laneEnds = [];
  items.forEach((it) => {
    let lane = laneEnds.findIndex((end) => end < it.startCol);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endCol); }
    else laneEnds[lane] = it.endCol;
    it.lane = lane;
  });
  return items;
}
