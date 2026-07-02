document.title = FIRMA_NAME + " - Abnahmeschein";

let currentScheine = null;

// Hooks für die gemeinsame Foto-Sektion (js/app-shared.js)
function appGetCurrentSchein() { return currentScheine; }
function appRerenderDetail() { if (currentScheine) render(); }
let sigPad = null;
let signFormOpen = false;
let materialSurveyOpen = false;
let photoEditOpen = false;







function openPhotoEdit() {
  vorherFotos = parsePhotoJson(currentScheine.vorher_fotos);
  nachherFotos = parsePhotoJson(currentScheine.nachher_fotos);
  photoEditOpen = true;
  render();
}

function cancelPhotoEdit() {
  photoEditOpen = false;
  render();
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
  render();
}


// Speichert Vorher-/Nachher-Fotos sofort, damit sie beim Verlassen nicht verloren gehen.





function appleMapsLink(adresse) {
  const query = encodeURIComponent((adresse || "").replace(/\n/g, ", "));
  return `https://maps.apple.com/?daddr=${query}`;
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

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getIdFromUrl() {
  const params = new URLSearchParams(location.search);
  return (params.get("id") || "").trim().toUpperCase();
}

async function init() {
  const id = getIdFromUrl();
  const view = document.getElementById("view");

  if (!id) {
    view.innerHTML = `<div class="card"><p>Kein Code angegeben. Bitte den vollständigen Link verwenden, den du bekommen hast.</p></div>`;
    return;
  }

  const { data, error } = await sb.from("scheine")
    .select("id, kunde, adresse, ansprechpartner, telefon, kategorie, leistungen, monat, kdnr, datum, unterschrift_name, anhang_name, anhang_type, interne_notiz, created_at, signed_at, termin, material_erfasst")
    .eq("id", id).maybeSingle();

  if (error || !data) {
    view.innerHTML = `<div class="card"><p>Abnahmeschein nicht gefunden. Bitte prüfe den Link oder frag noch einmal nach.</p></div>`;
    return;
  }

  currentScheine = data;
  render();

  const { data: heavy, error: heavyError } = await sb.from("scheine")
    .select("anhang, anhang_name, anhang_type, unterschrift, vorher_fotos, nachher_fotos")
    .eq("id", id).maybeSingle();

  if (!heavyError && heavy && currentScheine && currentScheine.id === id) {
    currentScheine = { ...currentScheine, ...heavy };
    // Zwischengespeicherte Fotos wieder in die Bearbeitungs-Arrays laden, sonst wirken sie
    // beim erneuten Öffnen verloren und würden beim nächsten Speichern überschrieben.
    if (!currentScheine.signed_at) {
      vorherFotos = parsePhotoJson(currentScheine.vorher_fotos);
      nachherFotos = parsePhotoJson(currentScheine.nachher_fotos);
    }
    if (!signFormOpen) render();
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

function render() {
  const s = currentScheine;
  const view = document.getElementById("view");
  const leistungenList = (s.leistungen || "").split("\n").filter((l) => l.trim())
    .map((l) => `<li>${escapeHtml(l.trim())}</li>`).join("");

  const alreadySigned = !!s.signed_at;

  view.innerHTML = `
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

        <div class="field">
          <label>Schein sofort per E-Mail senden an (optional)</label>
          <input type="email" id="f_email" placeholder="kunde@firma.de – leer lassen = kein Versand" />
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
  render();
}

function cancelSignForm() {
  signFormOpen = false;
  render();
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
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
  const versandEmail = document.getElementById("f_email")?.value.trim() || "";

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
      const queue = JSON.parse(localStorage.getItem("pending_saves") || "[]");
      queue.push({ id: currentScheine.id, payload, ts: Date.now() });
      localStorage.setItem("pending_saves", JSON.stringify(queue));
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
  showToast("Gespeichert");

  // Optionaler Sofort-Versand des unterschriebenen Scheins
  if (versandEmail && currentScheine && typeof generatePdf === "function") {
    try {
      const doc = generatePdf(currentScheine);
      await sendScheinPerMail(versandEmail, doc, `Abnahmeschein_${firstLine(currentScheine.adresse).replace(/[^a-z0-9äöüß]+/gi, "_") || "Schein"}.pdf`);
    } catch (e) { showToast("PDF-Versand fehlgeschlagen"); }
  }
  materialSurveyOpen = true;
  render();

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
  if (remaining.length < queue.length) showToast("Zwischengespeicherte Daten wurden nachgesendet");
}

window.addEventListener("online", flushOfflineQueue);

init();
flushOfflineQueue();

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
  render();
}

function skipMaterialSurvey() {
  materialSurveyOpen = false;
  render();
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
  materialSurveyOpen = false;
  showToast("Gespeichert");
  render();
}
