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
