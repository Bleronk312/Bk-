// Gemeinsame Bausteine ALLER Seiten (Graffiti-Admin/-Mitarbeiter/-Einzelschein + Glas).
// Vorher lagen diese Funktionen als Kopien in bis zu 5 Dateien - Fixes mussten mehrfach
// gemacht werden und liefen auseinander (siehe Foto-Zwischenspeichern-Bug). Jetzt: eine Stelle.
//
// Seiten-spezifische Hooks (werden von der jeweiligen Seite definiert, wo benötigt):
//   appGetCurrentSchein()  -> der gerade geöffnete Schein (für Foto-Speichern)
//   appRerenderDetail()    -> baut die Detailansicht der Seite neu auf

/* ---------------- Text säubern vor dem Speichern ---------------- */
// Postgres/PostgREST lehnt das NUL-Zeichen und diverse Steuerzeichen in
// Strings ab und meldet "unsupported Unicode escape sequence" - dann lässt sich der
// ganze Datensatz nicht speichern. Solche Zeichen rutschen unsichtbar mit, wenn man
// Text aus einem PDF oder einer anderen App in ein Feld einfügt. Vor dem Speichern
// entfernen (Zeilenumbruch \n, Tab \t und \r bleiben erhalten).
function gekoCleanText(v) {
  return typeof v === "string"
    ? v.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    : v;
}
// Alle String-Werte eines Payload-Objekts säubern (an Ort und Stelle) und zurückgeben.
function gekoCleanPayload(obj) {
  if (obj && typeof obj === "object") {
    for (const k in obj) if (typeof obj[k] === "string") obj[k] = gekoCleanText(obj[k]);
  }
  return obj;
}

/* ---------------- Anhänge am Abnahmeschein (Foto/PDF, mehrere möglich) ----------------
   Neue Spalte "anhaenge" (jsonb) hält eine Liste [{data,name,type}]. Abwärtskompatibel
   zum alten Einzel-Anhang (Spalten anhang/anhang_name/anhang_type): existiert nur der,
   wird er als 1-Element-Liste behandelt. */
function gekoAnhangListe(s) {
  let liste = [];
  const raw = s && s.anhaenge;
  if (raw) {
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(arr)) liste = arr.filter((a) => a && a.data);
    } catch (e) {}
  }
  if (!liste.length && s && s.anhang) {
    liste = [{ data: s.anhang, name: s.anhang_name || "Anhang", type: s.anhang_type || "" }];
  }
  return liste;
}

// Read-only Anzeige der Anhänge: Bilder direkt, PDF/Dateien als Öffnen-Knopf.
// openFnName = Name einer globalen Funktion, die mit dem Listen-Index aufgerufen wird.
function gekoRenderAnhaenge(s, openFnName) {
  if (!s || (!s.anhang_name && !s.anhang_type && !s.anhaenge)) return "";
  const liste = gekoAnhangListe(s);
  if (!liste.length) {
    return `<div class="card"><div class="muted" style="margin-bottom:6px;">Anhang</div><p class="muted" style="margin:0;">Lade...</p></div>`;
  }
  const titel = liste.length === 1 ? "Anhang" : `Anhänge (${liste.length})`;
  const items = liste.map((a, i) => {
    const isImg = (a.type || "").startsWith("image/");
    return isImg
      ? `<img src="${a.data}" style="max-width:100%; border-radius:8px; border:1px solid var(--border); margin-top:8px; display:block;" />`
      : `<button class="btn btn-sm" style="margin-top:8px;" onclick="${openFnName}(${i})">📎 ${escapeHtml(a.name || "Anhang öffnen")}</button>`;
  }).join("");
  return `<div class="card"><div class="muted" style="margin-bottom:2px;">${titel}</div>${items}</div>`;
}

/* ---------------- Service Worker: Offline-Fähigkeit ---------------- */
// Auf JEDER Seite registrieren (nicht nur beim Aktivieren von Push), damit die App-Shell
// zwischengespeichert wird und die App auch ohne Empfang öffnet. Läuft im Hintergrund
// und darf beim Öffnen nichts blockieren.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

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
        <img src="${src}" onclick="openPhotoViewer('${which}', ${i})" />
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
  photoViewerSets["vorher"] = () => vorherFotos;
  photoViewerSets["nachher"] = () => nachherFotos;
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
  const key = "galerie_" + label.replace(/[^a-z]/gi, "");
  photoViewerSets[key] = () => arr;
  const thumbs = arr.map((src, i) => `<div class="photo-thumb"><img src="${src}" onclick="openPhotoViewer('${key}', ${i})" /></div>`).join("");
  return `
    <div class="card">
      <div class="muted" style="margin-bottom:8px;">${label}</div>
      <div class="photo-grid">${thumbs}</div>
    </div>
  `;
}

/* ---------------- Foto-Vorschau (Vollbild-Lightbox mit Swipe) ---------------- */
//
// Tipp auf ein Foto öffnet es groß; wischen (oder ‹ ›) blättert durch die Bilder der
// jeweiligen Gruppe, ✕ oder Tipp auf den Hintergrund schließt.

const photoViewerSets = {}; // key -> Funktion, die das aktuelle Foto-Array liefert
let photoViewerState = null; // { key, index }

function openPhotoViewer(key, index) {
  const getArr = photoViewerSets[key];
  if (!getArr || !getArr().length) return;
  photoViewerState = { key, index: Math.max(0, Math.min(index, getArr().length - 1)) };
  let el = document.getElementById("photoViewer");
  if (!el) {
    el = document.createElement("div");
    el.id = "photoViewer";
    el.className = "photo-viewer";
    el.innerHTML = `
      <button class="pv-close" onclick="closePhotoViewer()">&times;</button>
      <button class="pv-nav pv-prev" onclick="stepPhotoViewer(-1)">&#8249;</button>
      <img class="pv-img" alt="" />
      <button class="pv-nav pv-next" onclick="stepPhotoViewer(1)">&#8250;</button>
      <div class="pv-counter"></div>
    `;
    el.addEventListener("click", (e) => { if (e.target === el) closePhotoViewer(); });
    // Swipe (Touch)
    let startX = null;
    el.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) stepPhotoViewer(dx < 0 ? 1 : -1);
      startX = null;
    }, { passive: true });
    document.body.appendChild(el);
  }
  el.style.display = "flex";
  document.body.style.overflow = "hidden";
  updatePhotoViewer();
}

function updatePhotoViewer(richtung) {
  if (!photoViewerState) return;
  const arr = photoViewerSets[photoViewerState.key]();
  const el = document.getElementById("photoViewer");
  if (!el || !arr.length) return closePhotoViewer();
  const img = el.querySelector(".pv-img");
  img.classList.remove("pv-slide-l", "pv-slide-r");
  void img.offsetWidth; // Animation neu starten
  if (richtung) img.classList.add(richtung > 0 ? "pv-slide-l" : "pv-slide-r");
  img.src = arr[photoViewerState.index];
  el.querySelector(".pv-counter").textContent = `${photoViewerState.index + 1} / ${arr.length}`;
  el.querySelector(".pv-prev").style.visibility = photoViewerState.index > 0 ? "visible" : "hidden";
  el.querySelector(".pv-next").style.visibility = photoViewerState.index < arr.length - 1 ? "visible" : "hidden";
}

function stepPhotoViewer(delta) {
  if (!photoViewerState) return;
  const arr = photoViewerSets[photoViewerState.key]();
  const next = photoViewerState.index + delta;
  if (next < 0 || next >= arr.length) return;
  photoViewerState.index = next;
  updatePhotoViewer(delta);
}

function closePhotoViewer() {
  const el = document.getElementById("photoViewer");
  if (el) el.style.display = "none";
  document.body.style.overflow = "";
  photoViewerState = null;
}

/* ---------------- Optionaler Sofort-Versand des Scheins per E-Mail ---------------- */
//
// Direkt nach der Unterschrift kann optional eine E-Mail-Adresse angegeben werden.
// Der Versand läuft automatisch über die Edge Function "send-schein" (Resend) - der Kunde
// bekommt das PDF direkt zugestellt, ohne dass jemand etwas tun muss. Ist die Funktion
// (noch) nicht eingerichtet oder schlägt der Versand fehl, öffnet sich als Fallback das
// Teilen-Menü des Geräts mit dem fertigen PDF (Adresse liegt in der Zwischenablage).

function istGueltigeEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
}

async function sendScheinPerMail(email, doc, filename) {
  email = (email || "").trim();
  if (!email) return;
  if (!istGueltigeEmail(email)) { showToast("E-Mail-Adresse sieht ungültig aus – nicht gesendet"); return; }

  // 1) Automatischer Versand über die Edge Function (Resend)
  try {
    showToast(`E-Mail an ${email} wird gesendet...`);
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    const { data, error } = await sb.functions.invoke("send-schein", {
      body: {
        to: email,
        subject: `Ihr Leistungsnachweis – ${filename.replace(/\.pdf$/i, "").replace(/_/g, " ")}`,
        filename,
        pdfBase64,
      },
    });
    if (!error && data && data.ok) {
      showToast(`✓ E-Mail an ${email} gesendet`);
      return;
    }
    console.error("send-schein fehlgeschlagen:", error || data);
  } catch (e) {
    console.error("send-schein nicht erreichbar:", e);
  }

  // 2) Fallback: Teilen-Menü / Download + Mail-Fenster
  try { await navigator.clipboard.writeText(email); } catch (e) {}
  const betreff = encodeURIComponent(`Leistungsnachweis ${filename.replace(/\.pdf$/i, "")}`);
  try {
    const blob = doc.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      showToast(`Automatischer Versand nicht verfügbar – Adresse ${email} kopiert, im Teilen-Menü Mail wählen`);
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
