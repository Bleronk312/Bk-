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
let glasOpenStopId = null;
let glasStopsRevealed = false; // "Tour starten" wurde getippt, Stopp-Liste sichtbar
let glasSigPad = null;
let glasFrueherExpanded = false; // "Frühere Touren"-Abschnitt aufgeklappt

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatGlasDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function glasMaInit() {
  renderGlasMa(); // Startseite sofort zeigen, Touren laden im Hintergrund
  await loadGlasTouren();
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
      if (glasOpenStopId) setTimeout(() => setupGlasSigPad(), 30);
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
  glasStopsRevealed = false;
  glasOpenStopId = null;
  renderGlasMa();
}

function closeGlasTour() {
  glasOpenTourId = null;
  glasStopsRevealed = false;
  glasOpenStopId = null;
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
    ${renderGlasRouteOverview(t)}
    ${!glasStopsRevealed
      ? `<button class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:16px;" onclick="glasStopsRevealed = true; renderGlasMa();">▶ Tour starten</button>`
      : `<button class="btn btn-sm" style="width:100%; justify-content:center; margin-bottom:10px;" onclick="glasStopsRevealed = false; renderGlasMa();">▲ Stopps einklappen</button>${renderGlasStopsList(t)}`
    }
  `;
}

function renderGlasRouteOverview(t) {
  const rows = t.stopps
    .map((s, idx) => {
      const isDone = s.status === "erledigt";
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; ${idx < t.stopps.length - 1 ? "border-bottom:1px solid var(--border);" : ""}">
          <div style="flex-shrink:0; width:26px; height:26px; border-radius:50%; background:${isDone ? "#1e7a34" : "#2d7dc4"}; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${isDone ? "✓" : idx + 1}</div>
          <div style="min-width:0;">
            <p style="margin:0; font-weight:600; font-size:14px; ${isDone ? "text-decoration:line-through; color:var(--text-secondary);" : ""}">${s.objekt ? escapeHtml(s.objekt) : `Stopp ${idx + 1}`}</p>
            <p class="muted" style="margin:0; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml((s.adresse || "").split("\n")[0])}</p>
          </div>
        </div>`;
    })
    .join("");
  return `<div class="card" style="margin:14px 0; padding:12px 16px;">${rows}</div>`;
}

function renderGlasStopsList(t) {
  return t.stopps
    .map((s, idx) => {
      const isOpen = glasOpenStopId === s.id;
      const isDone = s.status === "erledigt";
      const links = glasSingleMapLinks(s);
      return `
        <div style="border-radius:12px; padding:14px; margin-top:12px; background:${isDone ? "#eaf7ec" : "#f9fafb"}; border:1px solid ${isDone ? "#cdeed3" : "var(--border)"};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div>
              <p class="muted" style="margin:0 0 2px; font-size:12.5px;">Stopp ${idx + 1}${s.objekt ? " · " + escapeHtml(s.objekt) : ""}</p>
              <p style="margin:0; font-weight:600; font-size:15.5px; white-space:pre-line;">${escapeHtml(s.adresse)}</p>
            </div>
            <span class="badge ${isDone ? "badge-signed" : "badge-open"}">${isDone ? "✓ Erledigt" : "Offen"}</span>
          </div>
          ${!isDone ? `
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:12px;">
            <a class="btn btn-sm" href="${links.google}" target="_blank" style="justify-content:center;">🧭 Google</a>
            <a class="btn btn-sm" href="${links.apple}" style="justify-content:center;">🗺️ Apple</a>
            <a class="btn btn-sm" href="${links.waze}" style="justify-content:center;">📍 Waze</a>
          </div>` : ""}
          ${isDone
            ? `<button class="btn btn-sm" style="width:100%; justify-content:center; margin-top:10px;" onclick="toggleGlasStop('${s.id}')">${isOpen ? "Schließen" : "Details & PDF"}</button>`
            : `<button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:10px;" onclick="toggleGlasStop('${s.id}')">${isOpen ? "Schließen" : "✍️ Abnahmeschein unterschreiben"}</button>`
          }
          ${isOpen ? renderGlasSignArea(t, s) : ""}
        </div>`;
    })
    .join("");
}

function renderGlasSignArea(t, s) {
  if (s.status === "erledigt") {
    return `
      <div style="margin-top:12px; border-top:1px solid #cdeed3; padding-top:12px;">
        <p class="muted" style="margin:0 0 8px;">Unterschrieben von ${escapeHtml(s.name || "")} am ${formatGlasDate(s.datum)}</p>
        ${s.unterschrift ? `<img src="${s.unterschrift}" style="max-width:100%; border:1px solid var(--border); border-radius:8px; background:white;" />` : ""}
        <button class="btn btn-sm" style="margin-top:10px;" onclick="downloadGlasPdf('${t.id}','${s.id}')">📄 PDF öffnen</button>
      </div>`;
  }
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
      <input type="hidden" id="gs_datum" value="${today}" />
      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:16px;" onclick="saveGlasSignature('${s.id}')">✓ Unterschrift speichern</button>
    </div>`;
}

function toggleGlasStop(id) {
  glasOpenStopId = glasOpenStopId === id ? null : id;
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
  let stopRef = null;
  for (const t of glasTouren) {
    const stop = t.stopps.find((s) => s.id === stopId);
    if (stop) stopRef = stop;
  }

  const { error, payload } = await glasSignStop(stopId, stopRef?.positionen, name, datum, unterschrift);
  if (error) { showToast("Fehler beim Speichern: " + error.message); return; }
  if (stopRef) Object.assign(stopRef, payload);

  showToast("Gespeichert");
  glasOpenStopId = null;
  renderGlasMa();
}

function downloadGlasPdf(tourId, stopId) {
  const t = glasTouren.find((x) => x.id === tourId);
  const s = t?.stopps.find((x) => x.id === stopId);
  if (!s) return;
  const doc = generateGlasPdf(s, t.template, t.datum);
  doc.save(`Abnahmeschein_${(s.adresse || "").replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}

glasMaInit();
