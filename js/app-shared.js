// Gemeinsame Bausteine ALLER Seiten (Graffiti-Admin/-Mitarbeiter/-Einzelschein + Glas).
// Vorher lagen diese Funktionen als Kopien in bis zu 5 Dateien - Fixes mussten mehrfach
// gemacht werden und liefen auseinander (siehe Foto-Zwischenspeichern-Bug). Jetzt: eine Stelle.
//
// Seiten-spezifische Hooks (werden von der jeweiligen Seite definiert, wo benötigt):
//   appGetCurrentSchein()  -> der gerade geöffnete Schein (für Foto-Speichern)
//   appRerenderDetail()    -> baut die Detailansicht der Seite neu auf

/* ---------------- UI-Basics ---------------- */

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function firstLine(text) {
  return (text || "").split("\n")[0];
}

function formatTermin(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}. ${hh}:${min}`;
}

function telLink(telefon) {
  return `tel:${(telefon || "").replace(/[^0-9+]/g, "")}`;
}

function mapsLink(adresse) {
  const query = encodeURIComponent((adresse || "").replace(/\n/g, ", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function wazeLink(adresse) {
  const query = encodeURIComponent((adresse || "").replace(/\n/g, ", "));
  return `https://waze.com/ul?q=${query}&navigate=yes`;
}

/* ---------------- Foto-Upload (Supabase Storage mit Base64-Fallback) ---------------- */
//
// Fotos landen als JPEG im öffentlichen Storage-Bucket "fotos" - in der Tabelle steht dann
// nur noch die kleine URL statt des kompletten Bildes (hält die Datenbank schlank und die
// App schnell). Existiert der Bucket (noch) nicht, fällt der Upload still auf das bisherige
// Base64-Verhalten zurück - es geht also nichts kaputt, solange das Storage-SQL noch nicht
// eingespielt ist.

const PHOTO_MAX_DIM = 900;
const PHOTO_QUALITY = 0.65;
const PHOTO_MAX_COUNT = 15;
const FOTO_BUCKET = "fotos";

let vorherFotos = [];
let nachherFotos = [];

function compressPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > PHOTO_MAX_DIM || height > PHOTO_MAX_DIM) {
          if (width > height) {
            height = Math.round((height * PHOTO_MAX_DIM) / width);
            width = PHOTO_MAX_DIM;
          } else {
            width = Math.round((width * PHOTO_MAX_DIM) / height);
            height = PHOTO_MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
      };
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/data:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Lädt ein komprimiertes Bild in den Storage hoch und liefert die öffentliche URL.
// Schlägt der Upload fehl (Bucket fehlt, offline, ...), kommt die Base64-dataURL zurück.
async function uploadFotoToStorage(dataUrl, prefix) {
  try {
    if (!sb.storage) return dataUrl;
    const path = `${prefix || "foto"}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from(FOTO_BUCKET).upload(path, dataUrlToBlob(dataUrl), {
      contentType: "image/jpeg", upsert: false,
    });
    if (error) return dataUrl;
    const { data } = sb.storage.from(FOTO_BUCKET).getPublicUrl(path);
    return (data && data.publicUrl) ? data.publicUrl : dataUrl;
  } catch (e) {
    return dataUrl;
  }
}

// Best-effort-Löschen eines Storage-Fotos anhand seiner öffentlichen URL (Base64-Einträge
// und fremde URLs werden ignoriert). Fehler sind unkritisch - schlimmstenfalls bleibt eine
// verwaiste Datei im Bucket.
function deleteFotoFromStorage(url) {
  try {
    if (!sb.storage || typeof url !== "string") return;
    const marker = `/object/public/${FOTO_BUCKET}/`;
    const i = url.indexOf(marker);
    if (i < 0) return;
    const path = decodeURIComponent(url.slice(i + marker.length));
    sb.storage.from(FOTO_BUCKET).remove([path]);
  } catch (e) {}
}

// Holt ein Foto (URL oder dataURL) als dataURL - für die PDF-Erzeugung, die eingebettete
// Bilder braucht.
async function fotoAsDataUrl(src) {
  if (typeof src !== "string" || src.startsWith("data:")) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Foto konnte nicht geladen werden"));
    r.readAsDataURL(blob);
  });
}

/* ---------------- Vorher-/Nachher-Foto-Sektion ---------------- */

function parsePhotoJson(jsonStr) {
  if (!jsonStr) return [];
  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

async function handlePhotoSelect(event, which) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (!files.length) return;
  const arr = which === "vorher" ? vorherFotos : nachherFotos;
  const remaining = PHOTO_MAX_COUNT - arr.length;
  if (remaining <= 0) {
    showToast(`Maximal ${PHOTO_MAX_COUNT} Fotos`);
    return;
  }
  const toProcess = files.slice(0, remaining);
  if (files.length > remaining) showToast(`Nur die ersten ${remaining} Foto(s) wurden hinzugefügt (max. ${PHOTO_MAX_COUNT})`);
  for (const file of toProcess) {
    try {
      const compressed = await compressPhotoFile(file);
      const stored = await uploadFotoToStorage(compressed, which);
      arr.push(stored);
      refreshPhotoSection(); // nach jedem Foto direkt anzeigen, nicht erst am Ende
    } catch (e) {
      showToast("Ein Foto konnte nicht verarbeitet werden");
    }
  }
}

function removePhoto(which, index) {
  const arr = which === "vorher" ? vorherFotos : nachherFotos;
  const [removed] = arr.splice(index, 1);
  deleteFotoFromStorage(removed);
  refreshPhotoSection();
}

function refreshPhotoSection() {
  const el = document.getElementById("photoSectionWrap");
  if (el) {
    el.innerHTML = renderPhotoSection();
  } else if (typeof appRerenderDetail === "function") {
    appRerenderDetail();
  }
}

function renderPhotoSection() {
  const renderRow = (label, which) => {
    const arr = which === "vorher" ? vorherFotos : nachherFotos;
    const thumbs = arr.map((src, i) => `
      <div class="photo-thumb">
        <img src="${src}" />
        <button class="remove-btn" onclick="removePhoto('${which}', ${i})">&times;</button>
      </div>
    `).join("");
    const addBtn = arr.length < PHOTO_MAX_COUNT
      ? `<div class="photo-add-btn" onclick="document.getElementById('photoInput_${which}').click()">+</div>`
      : "";
    return `
      <div class="photo-section-label">${label}</div>
      <div class="photo-grid">${thumbs}${addBtn}</div>
      <input type="file" id="photoInput_${which}" accept="image/*" multiple style="display:none;" onchange="handlePhotoSelect(event, '${which}')" />
    `;
  };
  return `
    <div class="card">
      ${renderRow("Vorher-Fotos (optional)", "vorher")}
      <div style="height:10px;"></div>
      ${renderRow("Nachher-Fotos (optional)", "nachher")}
      <button class="btn btn-sm btn-primary" style="margin-top:12px; width:100%; justify-content:center;" onclick="saveVorherNachherNow()">💾 Fotos speichern</button>
      <p class="muted" style="margin:6px 0 0; font-size:11.5px;">Speichert die Fotos sofort – so gehen sie beim Verlassen der Seite nicht verloren.</p>
    </div>
  `;
}

function renderPhotoGallery(label, jsonStr) {
  const arr = parsePhotoJson(jsonStr);
  if (!arr.length) return "";
  const thumbs = arr.map((src) => `<div class="photo-thumb"><img src="${src}" /></div>`).join("");
  return `
    <div class="card">
      <div class="muted" style="margin-bottom:8px;">${label}</div>
      <div class="photo-grid">${thumbs}</div>
    </div>
  `;
}

/* ---------------- Optionaler Sofort-Versand des Scheins per E-Mail ---------------- */
//
// Direkt nach der Unterschrift kann optional eine E-Mail-Adresse angegeben werden. Ohne
// eigenen Mail-Server geht der Versand über das Teilen-Menü des Geräts: Auf dem Handy
// öffnet sich das Share-Sheet mit dem fertigen PDF (dort Mail antippen), die Adresse liegt
// schon in der Zwischenablage. Am Desktop wird das PDF heruntergeladen und das
// Mail-Programm mit vorausgefülltem Betreff geöffnet.

function istGueltigeEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
}

async function sendScheinPerMail(email, doc, filename) {
  email = (email || "").trim();
  if (!email) return;
  if (!istGueltigeEmail(email)) { showToast("E-Mail-Adresse sieht ungültig aus – nicht gesendet"); return; }
  try { await navigator.clipboard.writeText(email); } catch (e) {}
  const betreff = encodeURIComponent(`Leistungsnachweis ${filename.replace(/\.pdf$/i, "")}`);
  try {
    const blob = doc.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      showToast(`Adresse ${email} kopiert – im Teilen-Menü Mail wählen und einfügen`);
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) { /* Teilen abgebrochen oder nicht verfügbar -> Desktop-Weg */ }
  doc.save(filename);
  showToast(`PDF heruntergeladen – Mail an ${email} öffnet sich, PDF bitte anhängen`);
  setTimeout(() => { location.href = `mailto:${encodeURIComponent(email)}?subject=${betreff}`; }, 600);
}

// Speichert Vorher-/Nachher-Fotos sofort auf dem aktuellen Schein, damit sie nicht verloren
// gehen, wenn man die Seite verlässt bevor unterschrieben wurde.
async function saveVorherNachherNow() {
  const schein = typeof appGetCurrentSchein === "function" ? appGetCurrentSchein() : null;
  if (!schein || !schein.id) { showToast("Schein noch nicht gespeichert"); return; }
  const payload = {
    vorher_fotos: vorherFotos.length ? JSON.stringify(vorherFotos) : null,
    nachher_fotos: nachherFotos.length ? JSON.stringify(nachherFotos) : null,
  };
  const { error } = await sb.from("scheine").update(payload).eq("id", schein.id);
  if (error) { showToast("Fehler beim Speichern: " + error.message); return; }
  Object.assign(schein, payload);
  showToast("Fotos gespeichert");
}
