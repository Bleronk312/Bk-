document.title = "Glasreinigung - Meine Touren";

(function initGlasHeader() {
  const wm = document.getElementById("watermarkImg");
  const badge = document.getElementById("badgeLogoImg");
  if (typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined") {
    if (wm) wm.src = GEKO_LOGO_TRANSPARENT_B64;
    if (badge) badge.src = GEKO_LOGO_TRANSPARENT_B64;
  }
})();

let glasTouren = [];
let glasMaScreen = "home"; // "home" (Logo-Startseite) | "touren"
let glasOpenTourId = null; // gerade geöffnete Tour im Vollbild (ersetzt die Liste)
let glasOpenStopId = null; // aufgeklappter Stopp (Akkordeon)
let glasSignStopId = null; // Stopp, bei dem gerade das Unterschrift-Formular offen ist
let glasSigPad = null;
let glasFrueherExpanded = false; // "Frühere Touren"-Abschnitt aufgeklappt



function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function glasMaInit() {
  renderGlasMa(); // Startseite sofort zeigen, Touren laden im Hintergrund
  await loadGlasTouren();
  renderGlasMa();
}

// Logo oben links -> zurück zur Startseite (schließt auch eine offene Tour)
function glasMaGoHome() {
  glasMaScreen = "home";
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

async function loadGlasTouren() {
  const { data: touren, error } = await sb
    .from("glas_touren")
    .select("*")
    .order("datum", { ascending: false })
    .limit(60);
  if (error) {
    document.getElementById("view").innerHTML = `<p class="muted">Fehler beim Laden: ${escapeHtml(error.message)}</p>`;
    return;
  }
  const { data: stops } = await sb
    .from("glas_stopps")
    .select("*")
    .order("reihenfolge", { ascending: true });

  glasTouren = (touren || [])
    .filter((t) => !t.archiviert_am) // archivierte Touren gehören nicht in die Mitarbeiter-Ansicht
    .map((t) => ({
      ...t,
      stopps: (stops || []).filter((s) => s.tour_id === t.id),
    }));
}

function glasSingleMapLinks(stop) {
  const query = encodeURIComponent(`${stop.adresse || ""}`.replace(/\n/g, ", "));
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`,
    apple: `https://maps.apple.com/?daddr=${stop.lat},${stop.lng}&q=${query}`,
    waze: `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`,
  };
}

function renderGlasMa() {
  const view = document.getElementById("view");

  if (glasMaScreen === "home") {
    const heute = glasTouren.filter((t) => t.datum === todayIso()).length;
    view.innerHTML = `
      <div class="glas-welcome">
        <img class="glas-welcome-logo" src="${typeof GEKO_LOGO_TRANSPARENT_B64 !== "undefined" ? GEKO_LOGO_TRANSPARENT_B64 : ""}" alt="GEKO" />
        <p class="glas-welcome-title">Hallo GEKO Clean <span class="glas-welcome-heart">❤️</span></p>
        <p class="glas-welcome-sub">Schön, dass du da bist!</p>
        <div class="glas-welcome-buttons">
          <button class="btn btn-primary glas-welcome-btn" style="animation-delay:0.35s;" onclick="glasMaScreen = 'touren'; renderGlasMa();">
            🚐 Meine Touren${heute ? ` <span class="badge" style="background:rgba(255,255,255,0.25); color:white; margin-left:6px;">${heute} heute</span>` : ""}
          </button>
        </div>
      </div>`;
    return;
  }

  if (glasOpenTourId) {
    const t = glasTouren.find((x) => x.id === glasOpenTourId);
    if (t) {
      view.innerHTML = renderGlasTourScreen(t);
      if (glasSignStopId) setTimeout(() => setupGlasSigPad(), 30);
      return;
    }
  }

  if (!glasTouren.length) {
    view.innerHTML = `
      <button class="btn btn-sm" style="margin:16px 0;" onclick="glasMaScreen = 'home'; renderGlasMa();">&larr; Start</button>
      <div class="glas-empty">
        <div class="glas-empty-icon">🧽</div>
        <p style="font-weight:600; font-size:16px;">Noch keine Tour für dich</p>
        <p class="muted" style="margin-top:4px;">Sobald eine Tour für dich geplant ist, erscheint sie hier automatisch.</p>
      </div>`;
    return;
  }

  view.innerHTML = `
    <button class="btn btn-sm" style="margin:16px 0 4px;" onclick="glasMaScreen = 'home'; renderGlasMa();">&larr; Start</button>
    ${renderGlasTourList()}`;
}

function glasTourProgress(t) {
  const total = t.stopps.length;
  const done = t.stopps.filter((s) => s.status === "erledigt").length;
  const allDone = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, allDone, pct };
}

function renderGlasTourCard(t) {
  const { total, done, allDone, pct } = glasTourProgress(t);
  const isToday = t.datum === todayIso();
  const ringColor = allDone ? "#1e7a34" : "var(--blue)";
  const border = allDone ? "#cdeed3" : isToday ? "var(--blue)" : "var(--border)";
  const bg = allDone ? "#f2faf3" : isToday ? "#eaf2fb" : "var(--card)";
  return `
    <div class="card" style="cursor:pointer; display:flex; align-items:center; gap:14px; background:${bg}; border-color:${border};" onclick="openGlasTour('${t.id}')">
      <div class="glas-ring" style="--pct:${pct}%; --ring-color:${ringColor};">
        <div class="glas-ring-inner">${allDone ? "✓" : `${done}/${total}`}</div>
      </div>
      <div style="flex:1; min-width:0;">
        <p style="margin:0; font-weight:700; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}</p>
        <p class="muted" style="margin:3px 0 0;">${t.datum ? formatGlasDate(t.datum) : "Ohne Datum"}${isToday ? " · Heute" : ""}</p>
      </div>
      <span style="font-size:20px; color:var(--text-secondary); flex-shrink:0;">›</span>
    </div>`;
}

function renderGlasTourList() {
  const today = todayIso();
  const heute = [];
  const kommend = [];
  const frueher = [];
  glasTouren.forEach((t) => {
    if (t.datum === today) heute.push(t);
    else if (t.datum && t.datum > today) kommend.push(t);
    else frueher.push(t);
  });
  kommend.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  frueher.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

  let html = "";
  if (heute.length) {
    html += `<p class="glas-section-title">Heute</p>` + heute.map(renderGlasTourCard).join("");
  }
  if (kommend.length) {
    html += `<p class="glas-section-title">Kommende Touren</p>` + kommend.map(renderGlasTourCard).join("");
  }
  if (frueher.length) {
    html += `
      <p class="glas-section-title" style="cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="glasFrueherExpanded = !glasFrueherExpanded; renderGlasMa();">
        Frühere Touren (${frueher.length}) <span>${glasFrueherExpanded ? "▲" : "▼"}</span>
      </p>
      ${glasFrueherExpanded ? frueher.map(renderGlasTourCard).join("") : ""}`;
  }
  if (!heute.length && !kommend.length && !frueher.length) {
    html = `<p class="muted">Keine Touren gefunden.</p>`;
  }
  return html;
}

function openGlasTour(id) {
  glasOpenTourId = id;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

function closeGlasTour() {
  glasOpenTourId = null;
  glasOpenStopId = null;
  glasSignStopId = null;
  renderGlasMa();
}

function renderGlasTourScreen(t) {
  const done = t.stopps.filter((s) => s.status === "erledigt").length;

  return `
    <button class="btn btn-sm" style="margin-bottom:12px;" onclick="closeGlasTour()">&larr; Alle Touren</button>
    <div class="card">
      <p style="margin:0 0 4px; font-weight:700; font-size:17px;">${t.name ? escapeHtml(t.name) : (t.datum ? formatGlasDate(t.datum) : "Ohne Namen")}</p>
      <p class="muted" style="margin:0;">${t.datum ? formatGlasDate(t.datum) : ""}${t.datum ? " · " : ""}${done}/${t.stopps.length} erledigt</p>
    </div>
    <p class="muted" style="margin:14px 2px 4px; font-size:12.5px;">Auf einen Stopp tippen – dort stehen alle Infos und die Unterschrift.</p>
    ${renderGlasStopsList(t)}
  `;
}

// Gesamt-qm aus dem Positions-Schnappschuss des Stopps (deutsche Schreibweise)
function glasStopQm(s) {
  let sum = 0;
  try {
    JSON.parse(s.positionen || "[]").forEach((p) => {
      sum += parseFloat(String(p.qm || "").replace(",", ".")) || 0;
    });
  } catch (e) {}
  if (!sum) return "";
  return String(Math.round(sum * 100) / 100).replace(".", ",");
}

// Jeder Stopp ist eine Karte: zugeklappt nur Objekt, Adresse, qm und ein Vermerk,
// ob Hinweis/Notiz dran hängt - Tippen klappt alle Details samt Unterschrift auf.
function renderGlasStopsList(t) {
  return t.stopps
    .map((s, idx) => {
      const isOpen = glasOpenStopId === s.id;
      const isDone = s.status === "erledigt";
      const qm = glasStopQm(s);
      return `
        <div style="border-radius:12px; padding:13px 14px; margin-top:10px; cursor:pointer; background:${isDone ? "#eaf7ec" : "var(--card)"}; border:1px solid ${isDone ? "#cdeed3" : "var(--border)"};" onclick="toggleGlasStop('${s.id}')">
          <div style="display:flex; align-items:center; gap:11px;">
            <div style="flex-shrink:0; width:26px; height:26px; border-radius:50%; background:${isDone ? "#1e7a34" : "#2d7dc4"}; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${isDone ? "✓" : idx + 1}</div>
            <div style="flex:1; min-width:0;">
              <p style="margin:0; font-weight:600; font-size:14.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.objekt ? escapeHtml(s.objekt) : `Stopp ${idx + 1}`}</p>
              <p class="muted" style="margin:2px 0 0; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((s.adresse || "").split("\n")[0])}</p>
            </div>
            <div style="flex-shrink:0; text-align:right;">
              ${qm ? `<p style="margin:0; font-weight:700; font-size:13.5px; white-space:nowrap;">${qm} qm</p>` : ""}
              <p style="margin:2px 0 0; font-size:12px;">${s.hinweise ? "⚠️" : ""}${s.notiz ? "📝" : ""}<span style="color:var(--text-secondary);"> ${isOpen ? "▲" : "▼"}</span></p>
            </div>
          </div>
          ${isOpen ? renderGlasStopDetails(t, s, isDone) : ""}
        </div>`;
    })
    .join("");
}

function renderGlasStopDetails(t, s, isDone) {
  const links = glasSingleMapLinks(s);
  const qm = glasStopQm(s);
  return `
    <div style="margin-top:12px; border-top:1px solid ${isDone ? "#cdeed3" : "var(--border)"}; padding-top:12px;" onclick="event.stopPropagation();">
      <p style="margin:0; font-weight:600; font-size:15px; white-space:pre-line;">${escapeHtml(s.adresse)}</p>
      ${qm ? `<p class="muted" style="margin:6px 0 0;">Fläche: <b>${qm} qm</b></p>` : ""}
      ${s.hinweise ? `
      <div class="glas-hinweis-box">
        <span class="glas-hinweis-icon">⚠️</span>
        <div>
          <p class="glas-hinweis-title">Hinweis fürs Team</p>
          <p class="glas-hinweis-text">${escapeHtml(s.hinweise)}</p>
        </div>
      </div>` : ""}
      ${s.notiz ? `<div class="glas-notiz-box">📝 ${escapeHtml(s.notiz)}</div>` : ""}
      ${(s.ansprechpartner || s.telefon) ? `
      <div style="margin-top:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="muted" style="font-size:13px;">👤 ${escapeHtml(s.ansprechpartner || "Ansprechpartner")}${s.telefon ? " · " + escapeHtml(s.telefon) : ""}</span>
        ${s.telefon ? `<a class="btn btn-sm" href="tel:${escapeHtml(String(s.telefon).replace(/[^0-9+]/g, ""))}" style="justify-content:center;">📞 Anrufen</a>` : ""}
      </div>` : ""}
      ${!isDone && s.lat ? `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:12px;">
        <a class="btn btn-sm" href="${links.google}" target="_blank" style="justify-content:center;">🧭 Google</a>
        <a class="btn btn-sm" href="${links.apple}" style="justify-content:center;">🗺️ Apple</a>
        <a class="btn btn-sm" href="${links.waze}" style="justify-content:center;">📍 Waze</a>
      </div>` : ""}
      ${isDone
        ? `
      <div style="margin-top:12px; border-top:1px solid #cdeed3; padding-top:12px;">
        <p class="muted" style="margin:0 0 8px;">✍️ Unterschrieben von <b>${escapeHtml(s.name || "")}</b> am ${formatGlasDate(s.datum)}</p>
        ${s.zusatz ? `<div class="glas-notiz-box" style="margin:0 0 8px; white-space:pre-line;">➕ Zusätzlich: ${escapeHtml(s.zusatz)}</div>` : ""}
        ${s.unterschrift ? `<img src="${s.unterschrift}" style="max-width:100%; border:1px solid var(--border); border-radius:8px; background:white;" />` : ""}
        <button class="btn btn-sm" style="margin-top:10px;" onclick="downloadGlasPdf('${t.id}','${s.id}')">📄 PDF öffnen</button>
      </div>`
        : glasSignStopId === s.id
          ? renderGlasSignForm(s)
          : `<button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:12px; padding:13px; font-size:15.5px;" onclick="glasSignStopId = '${s.id}'; renderGlasMa();">✍️ Abnahmeschein unterschreiben</button>`
      }
    </div>`;
}

function renderGlasSignForm(s) {
  const today = todayIso();
  return `
    <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
      <div class="field">
        <label class="muted">Name der unterschreibenden Person</label>
        <input type="text" id="gs_name" placeholder="Vor- und Nachname" style="font-size:16px;" />
      </div>
      <div class="field">
        <label class="muted">Unterschrift</label>
        <canvas id="gs_sigCanvas" style="width:100%; height:180px; border:1px solid var(--border); border-radius:10px; background:white; touch-action:none;"></canvas>
        <button class="btn btn-sm" style="margin-top:8px;" onclick="clearGlasSig()">🗑️ Löschen & neu</button>
      </div>
      <div class="field">
        <label class="muted">➕ Extra was gemacht? (optional)</label>
        <div id="gs_zusatz_list">
          <textarea class="gs-zusatz" rows="2" style="font-size:16px;" placeholder="z.B. 2 Stunden zusätzlich"></textarea>
        </div>
        <button class="btn btn-sm" style="margin-top:8px;" onclick="glasZusatzAddField()">+ Noch etwas hinzufügen</button>
        <p class="muted" style="margin:6px 0 0; font-size:12px;">Jede Zeile steht als eigene Position mit auf dem Abnahmeschein.</p>
      </div>
      <input type="hidden" id="gs_datum" value="${today}" />
      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:16px;" onclick="saveGlasSignature('${s.id}')">✓ Unterschrift speichern</button>
    </div>`;
}

// Fügt ein weiteres Zusatz-Feld hinzu, ohne die Seite neu zu bauen (Unterschrift bleibt).
function glasZusatzAddField() {
  const list = document.getElementById("gs_zusatz_list");
  if (!list) return;
  const ta = document.createElement("textarea");
  ta.className = "gs-zusatz";
  ta.rows = 2;
  ta.style.fontSize = "16px";
  ta.style.marginTop = "8px";
  ta.placeholder = "z.B. 5 Fenster extra";
  list.appendChild(ta);
  ta.focus();
}

function toggleGlasStop(id) {
  glasOpenStopId = glasOpenStopId === id ? null : id;
  glasSignStopId = null;
  renderGlasMa();
}

function setupGlasSigPad() {
  const canvas = document.getElementById("gs_sigCanvas");
  if (!canvas) return;
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext("2d").scale(ratio, ratio);
  glasSigPad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
}

function clearGlasSig() {
  if (glasSigPad) glasSigPad.clear();
}

async function saveGlasSignature(stopId) {
  const name = document.getElementById("gs_name").value.trim();
  const datum = document.getElementById("gs_datum").value;
  if (!name) { showToast("Bitte Namen eintragen"); return; }
  if (!datum) { showToast("Bitte Datum wählen"); return; }
  if (!glasSigPad || glasSigPad.isEmpty()) { showToast("Bitte unterschreiben lassen"); return; }

  const unterschrift = glasSigPad.toDataURL("image/png");
  const zusatz = [...document.querySelectorAll(".gs-zusatz")].map((t) => t.value.trim()).filter(Boolean).join("\n");
  let stopRef = null;
  for (const t of glasTouren) {
    const stop = t.stopps.find((s) => s.id === stopId);
    if (stop) stopRef = stop;
  }

  const { error, payload } = await glasSignStop(stopId, stopRef?.positionen, name, datum, unterschrift, zusatz);
  if (error) { showToast("Fehler beim Speichern: " + error.message); return; }
  if (stopRef) Object.assign(stopRef, payload);

  showToast("Gespeichert");
  glasPushUnterschriftAnAdmin(stopRef, name, zusatz);
  // Stopp bleibt aufgeklappt und zeigt jetzt den grünen "Unterschrieben"-Block
  glasSignStopId = null;
  glasOpenStopId = stopId;
  renderGlasMa();
}

function downloadGlasPdf(tourId, stopId) {
  const t = glasTouren.find((x) => x.id === tourId);
  const s = t?.stopps.find((x) => x.id === stopId);
  if (!s) return;
  const doc = generateGlasPdf(s, t.template, t.datum);
  doc.save(glasScheinFilename(s, t.template));
}

// Meldet dem Admin eine frisch eingegangene Unterschrift (wenn der Schalter in den
// Admin-Einstellungen an ist). Fehler hier dürfen den Mitarbeiter nie stören.
async function glasPushUnterschriftAnAdmin(stop, name, zusatz) {
  try {
    const { data } = await sb.from("glas_einstellungen").select("push_unterschrift").eq("id", "default").limit(1);
    if (!data || !data[0] || !data[0].push_unterschrift) return;
    sb.functions.invoke("send-push", {
      body: {
        role: "admin",
        title: "✍️ Unterschrift eingegangen",
        body: `${stop?.objekt || "Stopp"} – unterschrieben von ${name}${zusatz ? " · Zusatz: " + zusatz : ""}`,
        url: "/glas-admin.html#/tab/touren",
      },
    }).catch(() => {});
  } catch (e) {}
}

glasMaInit();
