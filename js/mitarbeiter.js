document.title = FIRMA_NAME + " - Abnahmescheine";

function initHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
  if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  const greeting = document.getElementById("greetingText");
  if (greeting) {
    const name = typeof GREETING_NAME !== "undefined" ? GREETING_NAME : FIRMA_NAME;
    greeting.innerHTML = `Hallo ${name}! &#128147;`;
  }
}
try { initHeader(); } catch (e) { console.error("Header-Init fehlgeschlagen:", e); }
try { checkPushStatus(); } catch (e) {}

function updateHeaderStat(openCount) {
  const stat = document.getElementById("headerStat");
  if (stat) stat.textContent = `${openCount} offene Schein${openCount === 1 ? "" : "e"}`;
}

let scheine = [];
let currentScheine = null;
let sigPad = null;
let signFormOpen = false;
let materialSurveyOpen = false;
let photoEditOpen = false;
let vorherFotos = [];
let nachherFotos = [];

const PHOTO_MAX_DIM = 900;
const PHOTO_QUALITY = 0.65;
const PHOTO_MAX_COUNT = 5;

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
      arr.push(compressed);
    } catch (e) {
      showToast("Ein Foto konnte nicht verarbeitet werden");
    }
  }
  refreshPhotoSection();
}

function removePhoto(which, index) {
  const arr = which === "vorher" ? vorherFotos : nachherFotos;
  arr.splice(index, 1);
  refreshPhotoSection();
}

function refreshPhotoSection() {
  const el = document.getElementById("photoSectionWrap");
  if (el) {
    el.innerHTML = renderPhotoSection();
  } else {
    renderDetail();
  }
}

function parsePhotoJson(jsonStr) {
  if (!jsonStr) return [];
  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function openPhotoEdit() {
  vorherFotos = parsePhotoJson(currentScheine.vorher_fotos);
  nachherFotos = parsePhotoJson(currentScheine.nachher_fotos);
  photoEditOpen = true;
  renderDetail();
}

function cancelPhotoEdit() {
  photoEditOpen = false;
  renderDetail();
}

async function savePhotoEdit() {
  const payload = {
    vorher_fotos: vorherFotos.length ? JSON.stringify(vorherFotos) : null,
    nachher_fotos: nachherFotos.length ? JSON.stringify(nachherFotos) : null,
  };

  const { error } = await sb.from("scheine").update(payload).eq("id", currentScheine.id);
  if (error) {
    showToast("Fehler beim Speichern: " + error.message);
    return;
  }

  Object.assign(currentScheine, payload);
  photoEditOpen = false;
  showToast("Gespeichert");
  renderDetail();
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
    </div>
  `;
}

function renderPhotoGallery(label, jsonStr) {
  if (!jsonStr) return "";
  let arr = [];
  try { arr = JSON.parse(jsonStr); } catch (e) { return ""; }
  if (!arr.length) return "";
  const thumbs = arr.map((src) => `<div class="photo-thumb"><img src="${src}" /></div>`).join("");
  return `
    <div class="card">
      <div class="muted" style="margin-bottom:8px;">${label}</div>
      <div class="photo-grid">${thumbs}</div>
    </div>
  `;
}
let scheineSearchQuery = "";

const ARCHIVE_AFTER_DAYS = 3;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function escapeHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mapsLink(adresse) {
  const query = encodeURIComponent((adresse || "").replace(/\n/g, ", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function appleMapsLink(adresse) {
  const query = encodeURIComponent((adresse || "").replace(/\n/g, ", "));
  return `https://maps.apple.com/?daddr=${query}`;
}

function telLink(telefon) {
  return `tel:${(telefon || "").replace(/[^0-9+]/g, "")}`;
}

function openBase64File(dataUrl, filename) {
  try {
    const [header, base64] = dataUrl.split(",");
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    showToast("Datei konnte nicht geöffnet werden");
  }
}

function openAttachmentFile() {
  if (!currentScheine || !currentScheine.anhang) return;
  openBase64File(currentScheine.anhang, currentScheine.anhang_name || "anhang.pdf");
}

function firstLine(text) {
  return (text || "").split("\n")[0];
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
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

// ---------- Login ----------

function goBackToList() {
  history.back();
}

function queueOfflineSave(id, payload) {
  const queue = JSON.parse(localStorage.getItem("pending_saves") || "[]");
  queue.push({ id, payload, ts: Date.now() });
  localStorage.setItem("pending_saves", JSON.stringify(queue));
}

async function flushOfflineQueue() {
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem("pending_saves") || "[]"); } catch (e) {}
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    const { error } = await sb.from("scheine").update(item.payload).eq("id", item.id);
    if (error) remaining.push(item);
  }
  localStorage.setItem("pending_saves", JSON.stringify(remaining));
  if (remaining.length < queue.length) {
    showToast("Zwischengespeicherte Scheine wurden nachgesendet");
    loadList();
  }
}

window.addEventListener("online", flushOfflineQueue);

window.addEventListener("popstate", () => {
  if (calendarOpen) {
    calendarOpen = false;
    renderList();
    return;
  }
  if (currentScheine) {
    currentScheine = null;
    signFormOpen = false;
    renderList();
  }
});

loadList();
flushOfflineQueue();

// ---------- Week grouping + Archivierung ----------

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isArchived(s) {
  if (!s.signed_at) return false;
  const signedDate = new Date(s.signed_at);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_AFTER_DAYS);
  return signedDate < cutoff;
}

function groupByWeek(items) {
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  const groups = { "Diese Woche": [], "Letzte Woche": [], "Älter": [] };
  items.forEach((item) => {
    const d = new Date(item.created_at);
    if (d >= thisWeekStart) groups["Diese Woche"].push(item);
    else if (d >= lastWeekStart) groups["Letzte Woche"].push(item);
    else groups["Älter"].push(item);
  });

  function sortByTermin(arr) {
    return arr.sort((a, b) => {
      if (a.termin && b.termin) return new Date(a.termin) - new Date(b.termin);
      if (a.termin && !b.termin) return -1;
      if (!a.termin && b.termin) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }
  groups["Diese Woche"] = sortByTermin(groups["Diese Woche"]);
  groups["Letzte Woche"] = sortByTermin(groups["Letzte Woche"]);
  groups["Älter"] = sortByTermin(groups["Älter"]);

  return groups;
}

// ---------- List ----------

async function loadList() {
  const view = document.getElementById("view");
  view.innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;
  const { data, error } = await sb.from("scheine")
    .select("id, kunde, adresse, ansprechpartner, telefon, kategorie, leistungen, monat, kdnr, datum, unterschrift_name, anhang_name, anhang_type, interne_notiz, created_at, signed_at, termin, archiviert, material_erfasst")
    .eq("archiviert", false)
    .order("created_at", { ascending: false });
  if (error) {
    view.innerHTML = `<div class="card"><p style="color:#c0392b;">Fehler beim Laden: ${error.message}</p></div>`;
    return;
  }
  scheine = (data || []).filter((s) => !isArchived(s));
  currentScheine = null;
  renderList();
}

function matchesSearch(s, query) {
  if (!query) return true;
  const haystack = [s.kunde, s.adresse, s.kategorie].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function onScheineSearchInput(value) {
  scheineSearchQuery = value;
  renderList();
  const input = document.getElementById("scheineSearchInput");
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function renderList() {
  const view = document.getElementById("view");
  const filtered = scheine.filter((s) => matchesSearch(s, scheineSearchQuery));
  const open = filtered.filter((s) => !s.signed_at);
  const signed = filtered.filter((s) => s.signed_at).sort((a, b) => new Date(b.signed_at) - new Date(a.signed_at));
  const groups = groupByWeek(open);

  const allOpenCount = scheine.filter((s) => !s.signed_at).length;
  updateHeaderStat(allOpenCount);

  let html = `
    <div class="field">
      <input type="text" id="scheineSearchInput" placeholder="Suche nach Kunde, Adresse, Kategorie..." value="${escapeHtml(scheineSearchQuery)}" oninput="onScheineSearchInput(this.value)" />
    </div>
    <div style="display:flex; gap:8px; margin-bottom:16px;">
      <button class="btn btn-sm" onclick="openCalendar()">📅 Kalender</button>
      <button class="btn btn-sm" onclick="loadList()" title="Aktualisieren">🔄</button>
    </div>
  `;
  let any = false;
  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    any = true;
    html += `<div class="week-heading">${label}</div><div class="card" style="padding:6px 20px;">`;
    html += items.map(renderItem).join("");
    html += `</div>`;
  }
  if (signed.length) {
    any = true;
    html += `<div class="week-heading">Unterschriebene Scheine</div><div class="card" style="padding:6px 20px;">`;
    html += signed.map(renderItem).join("");
    html += `</div>`;
  }
  if (!any) {
    html += `<div class="card"><div class="empty-state">${scheineSearchQuery ? "Keine Treffer für diese Suche." : "Aktuell keine Abnahmescheine vorhanden."}</div></div>`;
  }

  view.innerHTML = html;
}

function renderItem(s) {
  const signed = !!s.signed_at;
  return `
    <div class="scheine-item" style="cursor:pointer;" onclick="openScheine('${s.id}')">
      <div class="ribbon ${signed ? "ribbon-done" : "ribbon-open"}">${signed ? "ERLEDIGT" : "OFFEN"}</div>
      <div class="scheine-item-content" style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:14.5px;">${escapeHtml(firstLine(s.adresse)) || "(ohne Adresse)"}</div>
        <div style="font-weight:600; font-size:13px;">${escapeHtml(s.kategorie || "")}</div>
        <div class="muted">${escapeHtml(firstLine(s.kunde))}</div>
        <div style="margin-top:6px;">
          ${s.termin ? `<span class="badge" style="background:#eaf3fb; color:#1f5d92;">📅 ${formatTermin(s.termin)}</span>` : ""}
          ${s.anhang_name ? `<span class="badge" style="background:#eef2f7; color:#475569;">📎 Anhang</span>` : ""}
          ${s.interne_notiz ? `<span class="badge" style="background:#fff4e0; color:#8a5a07;">📝 Notiz</span>` : ""}
          ${signed && !s.material_erfasst ? `<span class="badge" style="background:#fff8ec; color:#8a5a07;">📦 Material eintragen</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

// ---------- Detail / sign ----------

async function openScheine(id) {
  const light = scheine.find((s) => s.id === id);
  currentScheine = light ? { ...light } : { id };
  signFormOpen = false;
  materialSurveyOpen = false;
  photoEditOpen = false;
  vorherFotos = [];
  nachherFotos = [];
  history.pushState({ schein: id }, "");
  renderDetail();

  const { data, error } = await sb.from("scheine")
    .select("anhang, anhang_name, anhang_type, unterschrift, vorher_fotos, nachher_fotos")
    .eq("id", id)
    .maybeSingle();

  if (!error && data && currentScheine && currentScheine.id === id) {
    currentScheine = { ...currentScheine, ...data };
    if (!signFormOpen) renderDetail();
  }
}

function renderAttachment(s) {
  if (!s.anhang_name && !s.anhang_type) return "";
  if (!s.anhang) {
    return `
      <div class="card">
        <div class="muted" style="margin-bottom:6px;">Anhang</div>
        <p class="muted" style="margin:0;">Lade...</p>
      </div>
    `;
  }
  const isImg = (s.anhang_type || "").startsWith("image/");
  if (isImg) {
    return `
      <div class="card">
        <div class="muted" style="margin-bottom:6px;">Anhang</div>
        <img src="${s.anhang}" style="max-width:100%; border-radius:8px; border:1px solid var(--border);" />
      </div>
    `;
  }
  return `
    <div class="card">
      <div class="muted" style="margin-bottom:6px;">Anhang</div>
      <button class="btn btn-sm" onclick="openAttachmentFile()">📎 ${escapeHtml(s.anhang_name || "Anhang öffnen")}</button>
    </div>
  `;
}

function renderDetail() {
  const s = currentScheine;
  const view = document.getElementById("view");
  const leistungenList = (s.leistungen || "").split("\n").filter((l) => l.trim())
    .map((l) => `<li>${escapeHtml(l.trim())}</li>`).join("");

  const alreadySigned = !!s.signed_at;

  view.innerHTML = `
    <button class="btn btn-sm" onclick="goBackToList()" style="margin-bottom:14px;">&larr; Zurück zur Liste</button>

    <div class="card">
      <div class="muted" style="font-size:12px; margin-bottom:10px;">${escapeHtml(firstLine(s.kunde))}</div>

      <div class="muted" style="margin-bottom:2px;">Objekt</div>
      <div class="highlight-box" style="white-space:pre-line;">${escapeHtml(s.adresse)}</div>
      <a href="${appleMapsLink(s.adresse)}"><button class="btn btn-sm" style="margin-bottom:12px;">🗺️ Route (Apple Karten)</button></a>
      <a href="${mapsLink(s.adresse)}" target="_blank" rel="noopener"><button class="btn btn-sm" style="margin-bottom:12px;">🧭 Route (Google Maps)</button></a>

      ${s.ansprechpartner ? `<div class="muted" style="margin-bottom:2px;">Ansprechpartner vor Ort</div><div class="highlight-box">${escapeHtml(s.ansprechpartner)}${s.telefon ? " &middot; " + escapeHtml(s.telefon) : ""}</div>${s.telefon ? `<a href="${telLink(s.telefon)}"><button class="btn btn-sm" style="margin-bottom:12px;">📞 Anrufen</button></a>` : ""}` : ""}

      ${s.termin ? `<div class="muted" style="margin-bottom:2px;">Termin</div><div class="highlight-box">📅 ${formatTermin(s.termin)}</div>` : ""}

      <div class="divider"></div>

      <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(s.kategorie || "")}</div>
      <div class="muted" style="margin-bottom:6px;">${escapeHtml(s.monat || "")}${s.kdnr ? " &middot; Kd.-Nr. " + escapeHtml(s.kdnr) : ""}</div>
      <ul class="bullet-list">${leistungenList}</ul>
    </div>

    ${s.interne_notiz ? `
      <div class="card" style="background:#fff8ec; border-color:#f0d9a8;">
        <div style="font-weight:600; font-size:13px; color:#8a5a07; margin-bottom:4px;">📝 Interne Notiz</div>
        <div style="white-space:pre-line; font-size:14px;">${escapeHtml(s.interne_notiz)}</div>
      </div>
    ` : ""}

    ${renderAttachment(s)}

    ${alreadySigned ? `
      <div class="card">
        <p style="margin:0 0 8px;"><span class="badge badge-signed">Bereits unterschrieben am ${formatDateDisplay(s.datum)}</span></p>
        ${s.unterschrift_name ? `<p class="muted" style="margin:0 0 8px;">Von: ${escapeHtml(s.unterschrift_name)}</p>` : ""}
        ${s.unterschrift ? `<img src="${s.unterschrift}" style="max-width:100%; border:1px solid var(--border); border-radius:8px;" />` : `<p class="muted">Lade Unterschrift...</p>`}
      </div>
      ${photoEditOpen ? `
        <div id="photoSectionWrap">${renderPhotoSection()}</div>
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button class="btn btn-sm" onclick="cancelPhotoEdit()">Abbrechen</button>
          <button class="btn btn-primary" style="flex:1;" onclick="savePhotoEdit()">Fotos speichern</button>
        </div>
      ` : `
        ${renderPhotoGallery("Vorher-Fotos", s.vorher_fotos)}
        ${renderPhotoGallery("Nachher-Fotos", s.nachher_fotos)}
        <button class="btn btn-sm" onclick="openPhotoEdit()" style="margin-bottom:14px;">📷 Fotos bearbeiten</button>
      `}

      ${materialSurveyOpen ? renderMaterialSurvey(s) : !s.material_erfasst ? `
        <div class="material-reminder">
          <span>📦 Hier noch Material eintragen!</span>
          <button class="btn btn-sm" onclick="openMaterialSurvey()">Jetzt eintragen</button>
        </div>
      ` : `
        <button class="btn btn-sm" onclick="openMaterialSurvey()" style="margin-bottom:14px;">📦 Material-Angaben bearbeiten</button>
      `}
    ` : `
      <div id="photoSectionWrap">${renderPhotoSection()}</div>

      ${signFormOpen ? `
        <div class="card" id="signForm">
          <h2>Abnahme bestätigen</h2>
          <p class="muted" style="margin-top:-4px;">Die ordnungsgemäße Durchführung der Arbeiten wird bestätigt. Spätere Reklamationen können nicht anerkannt werden.</p>

          <div class="field">
            <label>Name der unterschreibenden Person</label>
            <input type="text" id="f_name" placeholder="Vor- und Nachname" />
          </div>

          <div class="field">
            <label>Datum</label>
            <input type="date" id="f_datum" value="${todayIso()}" />
          </div>

          <label>Unterschrift</label>
          <div class="sig-pad-wrap">
            <canvas id="sigCanvas"></canvas>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px; margin-bottom:16px;">
            <button class="btn btn-sm" onclick="clearSig()">Löschen</button>
            <button class="btn btn-sm" onclick="cancelSignForm()">Abbrechen</button>
          </div>

          <button class="btn btn-primary btn-block" onclick="saveSignature()">Speichern</button>
        </div>
      ` : `
        <button class="btn btn-primary btn-block" onclick="openSignForm()">Jetzt unterschreiben</button>
      `}
    `}
  `;

  if (!alreadySigned && signFormOpen) setupSigPad();
}

function openSignForm() {
  signFormOpen = true;
  renderDetail();
}

function cancelSignForm() {
  signFormOpen = false;
  renderDetail();
}

function setupSigPad() {
  const canvas = document.getElementById("sigCanvas");
  if (!canvas) return;
  resizeCanvas(canvas);
  sigPad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
  window.addEventListener("resize", () => resizeCanvas(canvas));
}

function resizeCanvas(canvas) {
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  if (sigPad) sigPad.clear();
}

function clearSig() {
  if (sigPad) sigPad.clear();
}



async function saveSignature() {
  const name = document.getElementById("f_name").value.trim();
  const datum = document.getElementById("f_datum").value;

  if (!name) { showToast("Bitte Namen der unterschreibenden Person eintragen"); return; }
  if (!datum) { showToast("Bitte ein Datum wählen"); return; }
  if (!sigPad || sigPad.isEmpty()) { showToast("Bitte unterschreiben"); return; }

  const unterschrift = sigPad.toDataURL("image/png");

  const payload = {
    datum,
    unterschrift,
    unterschrift_name: name,
    signed_at: new Date().toISOString(),
  };
  if (vorherFotos.length) payload.vorher_fotos = JSON.stringify(vorherFotos);
  if (nachherFotos.length) payload.nachher_fotos = JSON.stringify(nachherFotos);

  const { error } = await sb.from("scheine").update(payload).eq("id", currentScheine.id);

  if (error) {
    if (!navigator.onLine) {
      queueOfflineSave(currentScheine.id, payload);
      showToast("Kein Empfang – wird automatisch gesendet, sobald wieder Netz da ist");
    } else {
      showToast("Fehler beim Speichern: " + error.message);
      return;
    }
  }

  currentScheine.datum = datum;
  currentScheine.unterschrift = unterschrift;
  currentScheine.unterschrift_name = name;
  currentScheine.signed_at = new Date().toISOString();
  if (payload.vorher_fotos) currentScheine.vorher_fotos = payload.vorher_fotos;
  if (payload.nachher_fotos) currentScheine.nachher_fotos = payload.nachher_fotos;

  const listEntry = scheine.find((s) => s.id === currentScheine.id);
  if (listEntry) {
    listEntry.datum = datum;
    listEntry.unterschrift_name = name;
    listEntry.signed_at = currentScheine.signed_at;
  }

  showToast("Gespeichert");
  materialSurveyOpen = true;
  renderDetail();

  try {
    sb.functions.invoke("send-push", {
      body: {
        role: "admin",
        title: "✅ Schein unterschrieben!",
        body: `${firstLine(currentScheine.adresse) || "Ein Abnahmeschein"} wurde gerade von ${name} unterschrieben.`,
      },
    });
  } catch (e) {}
}

// ---------- Kalender ----------

let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let calTermine = [];
let calSelectedDay = null;
let calendarOpen = false;

async function openCalendar() {
  history.pushState({ calendar: true }, "");
  calendarOpen = true;
  const now = new Date();
  calMonth = now.getMonth();
  calYear = now.getFullYear();
  calSelectedDay = now.getDate();
  document.getElementById("view").innerHTML = `<p class="muted"><span class="spinner"></span>Lade...</p>`;

  const { data, error } = await sb.from("scheine")
    .select("id, adresse, kategorie, termin, signed_at")
    .not("termin", "is", null)
    .eq("archiviert", false);

  if (!error) calTermine = data || [];
  renderCalendar();
}

function closeCalendar() {
  history.back();
}

function calNav(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  calSelectedDay = null;
  renderCalendar();
}

function calSelectDay(day, inMonth) {
  if (!inMonth) return;
  calSelectedDay = day;
  renderCalendar();
}

function renderCalendar() {
  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const firstOfMonth = new Date(calYear, calMonth, 1);
  let startWeekday = firstOfMonth.getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1; // Montag = 0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  const today = new Date();
  const isToday = (day) => day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

  const termineForDay = (day) => calTermine.filter((t) => {
    const d = new Date(t.termin);
    return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear;
  });

  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cellArr = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startWeekday + 1;
    let label;
    let inMonth = true;
    let weekendClass = "";
    const colIndex = i % 7;
    if (colIndex === 5) weekendClass = "cal-sat";
    if (colIndex === 6) weekendClass = "cal-sun";

    if (dayNum < 1) {
      label = daysInPrevMonth + dayNum;
      inMonth = false;
    } else if (dayNum > daysInMonth) {
      label = dayNum - daysInMonth;
      inMonth = false;
    } else {
      label = dayNum;
    }

    const termine = inMonth ? termineForDay(dayNum) : [];
    const hasTermine = termine.length > 0;
    const chips = termine.slice(0, 2).map((t) =>
      `<div class="cal-chip ${t.signed_at ? "done" : ""}">${escapeHtml(firstLine(t.adresse))}</div>`
    ).join("");

    const isSelected = inMonth && calSelectedDay === dayNum;
    const numHtml = inMonth && isToday(dayNum)
      ? `<div class="cal-todaycircle">${label}</div>`
      : `<div class="cal-daynum">${label}</div>`;

    const classes = [
      inMonth ? "" : "cal-other",
      weekendClass,
      hasTermine ? "cal-has-termin" : "",
      isSelected ? "cal-selected" : "",
    ].filter(Boolean).join(" ");

    cellArr.push(
      `<td class="${classes}"><button type="button" class="cal-day-btn" onclick="calSelectDay(${dayNum}, ${inMonth})">${numHtml}${chips}</button></td>`
    );
  }

  let rows = "";
  for (let r = 0; r < cellArr.length / 7; r++) {
    rows += `<tr>${cellArr.slice(r * 7, r * 7 + 7).join("")}</tr>`;
  }

  const dayTermine = calSelectedDay ? termineForDay(calSelectedDay) : [];
  const dayLabel = calSelectedDay ? `${calSelectedDay}. ${monthNames[calMonth]} ${calYear}` : "";

  document.getElementById("view").innerHTML = `
    <div class="cal-topbar">
      <button class="btn btn-sm" onclick="closeCalendar()">&larr; Zurück</button>
    </div>

    <div class="cal-month-header">
      <span class="cal-nav-btn" onclick="calNav(-1)">&lsaquo;</span>
      <span class="cal-month-title">${monthNames[calMonth]} ${calYear}</span>
      <span class="cal-nav-btn" onclick="calNav(1)">&rsaquo;</span>
    </div>

    <div class="card cal-card">
      <table class="cal-table">
        <tr><th>MO</th><th>DI</th><th>MI</th><th>DO</th><th>FR</th><th>SA</th><th>SO</th></tr>
        ${rows}
      </table>
    </div>

    ${calSelectedDay ? `
      <div class="cal-day-list-heading">${dayTermine.length ? "Termine am" : "Keine Termine am"} ${dayLabel}</div>
      ${dayTermine.length ? dayTermine.map((t) => `
        <div class="card cal-appt-card" onclick="closeCalendarAndOpen('${t.id}')">
          <div class="cal-appt-time">${formatTermin(t.termin).split(" ")[1] || ""}</div>
          <div class="cal-appt-bar ${t.signed_at ? "done" : ""}"></div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:14.5px;">${escapeHtml(firstLine(t.adresse))}</div>
            <div class="muted" style="font-size:12.5px;">${escapeHtml(t.kategorie || "")}</div>
          </div>
          <span class="badge ${t.signed_at ? "badge-signed" : "badge-open"}" style="flex:0 0 auto;">${t.signed_at ? "Erledigt" : "Offen"}</span>
        </div>
      `).join("") : ""}
    ` : ""}
  `;
}

function closeCalendarAndOpen(id) {
  history.back();
  setTimeout(() => openScheine(id), 50);
}

// ---------- Material-Umfrage ----------

const MATERIAL_FULL_CATEGORIES = ["graffitientfernung", "sonderreinigung", "grundreinigung"];

function isFullMaterialCategory(kategorie) {
  return MATERIAL_FULL_CATEGORIES.includes((kategorie || "").trim().toLowerCase());
}

function hourOptions(selected) {
  let html = `<option value="">–</option>`;
  for (let i = 0; i <= 20; i++) {
    const val = (i * 0.5).toFixed(1).replace(".0", "");
    const sel = selected && parseFloat(selected) === i * 0.5 ? "selected" : "";
    html += `<option value="${val}" ${sel}>${val} Std.</option>`;
  }
  return html;
}

function qtyOptions(selected) {
  let html = `<option value="">–</option>`;
  for (let i = 1; i <= 10; i++) {
    const sel = String(selected) === String(i) ? "selected" : "";
    html += `<option value="${i}" ${sel}>${i}</option>`;
  }
  return html;
}

function renderMaterialSurvey(s) {
  const full = isFullMaterialCategory(s.kategorie);
  return `
    <div class="card" id="materialSurvey">
      <h2>Kurze Angaben zum Einsatz</h2>
      <p class="muted" style="margin-top:-4px;">Optional – hilft uns bei der Material- und Zeitplanung.</p>

      <div class="field">
        <label>Wie viele Stunden warst du insgesamt vor Ort?</label>
        <select id="m_stunden">${hourOptions(s.material_stunden)}</select>
      </div>

      ${full ? `
        <div class="section-title" style="margin-top:18px;">Materialverbrauch</div>
        <div class="qty-row">
          <span class="qty-label">Graffiti Ex Spray</span>
          <select id="m_ex_spray">${qtyOptions(s.material_graffiti_ex_spray)}</select>
        </div>
        <div class="qty-row">
          <span class="qty-label">Graffiti Gel</span>
          <select id="m_gel">${qtyOptions(s.material_graffiti_gel)}</select>
        </div>
        <div class="qty-row">
          <span class="qty-label">Paint Cleaner</span>
          <select id="m_cleaner">${qtyOptions(s.material_paint_cleaner)}</select>
        </div>

        <div class="section-title" style="margin-top:18px;">Verwendete Geräte</div>
        <label class="check-row">
          <input type="checkbox" id="m_streichen" ${s.material_streichen ? "checked" : ""} />
          <span class="check-label">Streichen mit Farbe</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="m_hochdruck" ${s.material_hochdruck ? "checked" : ""} />
          <span class="check-label">Hochdruckreiniger</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="m_sandstrahl" ${s.material_sandstrahl ? "checked" : ""} />
          <span class="check-label">Sandstrahlgerät</span>
        </label>
      ` : `
        <div class="field" style="margin-top:14px;">
          <label>Verwendetes Material (optional)</label>
          <textarea id="m_freitext" rows="2" placeholder="z.B. 2x Reiniger, 1x Lappenpaket">${escapeHtml(s.material_freitext || "")}</textarea>
        </div>
      `}

      <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn btn-sm" onclick="skipMaterialSurvey()">Später ausfüllen</button>
        <button class="btn btn-primary" style="flex:1;" onclick="saveMaterialSurvey()">Speichern</button>
      </div>
    </div>
  `;
}

function openMaterialSurvey() {
  materialSurveyOpen = true;
  renderDetail();
}

function skipMaterialSurvey() {
  materialSurveyOpen = false;
  renderDetail();
}

async function saveMaterialSurvey() {
  const full = isFullMaterialCategory(currentScheine.kategorie);
  const payload = {
    material_erfasst: true,
    material_stunden: document.getElementById("m_stunden").value || null,
  };
  if (full) {
    payload.material_graffiti_ex_spray = document.getElementById("m_ex_spray").value || null;
    payload.material_graffiti_gel = document.getElementById("m_gel").value || null;
    payload.material_paint_cleaner = document.getElementById("m_cleaner").value || null;
    payload.material_streichen = document.getElementById("m_streichen").checked;
    payload.material_hochdruck = document.getElementById("m_hochdruck").checked;
    payload.material_sandstrahl = document.getElementById("m_sandstrahl").checked;
  } else {
    payload.material_freitext = document.getElementById("m_freitext").value || null;
  }

  const { error } = await sb.from("scheine").update(payload).eq("id", currentScheine.id);
  if (error) {
    showToast("Fehler beim Speichern: " + error.message);
    return;
  }

  Object.assign(currentScheine, payload);
  const listEntry = scheine.find((s) => s.id === currentScheine.id);
  if (listEntry) Object.assign(listEntry, payload);

  materialSurveyOpen = false;
  showToast("Gespeichert");
  renderDetail();
}
