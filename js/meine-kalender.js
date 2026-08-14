// GEKO One · Kalender für Mitarbeiter
//
// Führt alle Termine zusammen, die den angemeldeten Mitarbeiter betreffen - und NUR die.
// Quellen (je nach Freischaltung):
//   🧽 Glas-Touren      (zugang_glas)      -> glas_touren, über Start-/Endedatum
//   🎨 Graffiti-Termine (zugang_graffiti)  -> scheine.termin
//   📍 Rundgänge        (zugang_checkin)   -> checkin_rundgaenge (Wochentage)
//   🏖️ Urlaub           immer               -> glas_urlaub, AUSSCHLIESSLICH der eigene
//
// DATENSCHUTZ: Urlaub wird strikt auf die eigene mitarbeiter_id gefiltert - der Urlaub
// von Kollegen taucht hier nie auf. Auch Rundgänge erscheinen nur, wenn sie dem
// Mitarbeiter zugewiesen sind (oder ausdrücklich für alle gelten).

// Kräftige, klar unterscheidbare Farben je Bereich - im Monatsraster sind das nur
// kleine Punkte, deshalb bewusst satt statt pastellig.
const ONE_KAL_FARBEN = {
  glas: "#1668b8",      // Blau
  graffiti: "#c2189c",  // Magenta
  checkin: "#ef7d00",   // Orange
  urlaub: "#12a150",    // Grün
  erledigt: "#8e99a6",  // Grau: erledigt = tritt zurück
};

let oneKalTermine = null;   // geladene Termine (Array) oder null = noch nicht geladen
let oneKalMonat = null;     // {jahr, monat} - angezeigter Monat, null = aktueller
let oneKalFehler = "";

function oneKalHeute() { return glasIsoFromDate(new Date()); }

function oneKalMonatJetzt() {
  if (oneKalMonat) return oneKalMonat;
  const d = new Date();
  return { jahr: d.getFullYear(), monat: d.getMonth() }; // monat 0-11
}

function oneKalBlaettern(schritt) {
  const m = oneKalMonatJetzt();
  const d = new Date(m.jahr, m.monat + schritt, 1);
  oneKalMonat = { jahr: d.getFullYear(), monat: d.getMonth() };
  renderOne();
}

// Verhindert, dass eine einzelne hängende Abfrage den ganzen Kalender blockiert:
// Nach spätestens 8 Sekunden gibt eine Quelle auf (leeres Ergebnis) statt ewig zu warten.
function oneKalMitTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Zeitüberschreitung")), ms || 8000)),
  ]);
}

let oneKalLaeuft = false; // schützt vor doppeltem Laden

// Lädt alle Quellen parallel. Jede Quelle einzeln abgesichert: fällt eine aus (Tabelle
// fehlt, kein Netz, Zeitüberschreitung), bleiben die anderen trotzdem stehen. Der
// Kalender kann dadurch NIE ewig im Ladekreis hängen.
async function oneKalLaden() {
  const eintraege = [];
  const ich = oneUser.id;
  const aufgaben = [];

  // --- Glas-Touren -------------------------------------------------------------
  if (oneUser.zugang_glas !== false) {
    aufgaben.push((async () => {
      // Stopps mitladen: nur damit steht fest, ob eine Tour in der Touren-App
      // überhaupt noch geöffnet werden KANN. Die App blendet alte, komplett
      // erledigte Touren aus - ohne diese Prüfung landete ein Klick darauf in
      // einer leeren Liste statt bei der Tour.
      const [tRes, sRes] = await Promise.all([
        oneKalMitTimeout(sb.from("glas_touren").select("id, name, datum, datum_bis, archiviert_am, ma_versteckt").order("datum", { ascending: true })),
        oneKalMitTimeout(sb.from("glas_stopps").select("tour_id, status, signed_at, datum")).catch(() => ({ data: [] })),
      ]);
      const stopps = (sRes && sRes.data) || [];
      const heute = oneKalHeute();
      (tRes.data || []).forEach((t) => {
        // Vom Admin ausgeblendete Touren gehören nie in die MA-Ansicht.
        if (!t.datum || t.ma_versteckt) return;
        const meine = stopps.filter((s) => s.tour_id === t.id);
        const offen = meine.some((s) => s.status === "offen");
        const ende = t.datum_bis || t.datum;
        // "Abgelaufen" = in der Touren-App nicht mehr vorhanden: entweder archiviert
        // oder vorbei UND vollständig erledigt. Eine vergangene Tour mit noch offenen
        // Stopps bleibt bewusst öffenbar - die muss der Mitarbeiter ja nacharbeiten.
        const abgelaufen = !!t.archiviert_am || (ende < heute && meine.length > 0 && !offen);
        eintraege.push({
          art: "glas", ico: "🧽", titel: t.name || "Tour",
          von: t.datum, bis: ende,
          sub: abgelaufen ? "Glas-Tour · abgeschlossen" : "Glas-Tour",
          // Direkt IN die Tour springen (nicht nur in die App)
          ziel: abgelaufen ? null : `glas-mitarbeiter.html?tour=${encodeURIComponent(t.id)}`,
          abgelaufen,
        });
      });
    })());
  }

  // --- Graffiti-Termine --------------------------------------------------------
  if (oneUser.zugang_graffiti === true) {
    aufgaben.push((async () => {
      const { data } = await oneKalMitTimeout(sb.from("scheine").select("id, kunde, adresse, termin, archiviert, datum").order("termin", { ascending: true }));
      (data || []).forEach((s) => {
        if (!s.termin || s.archiviert) return;
        const iso = String(s.termin).slice(0, 10);
        const zeit = glasUhrzeitVonTimestamp(s.termin);
        eintraege.push({
          art: "graffiti", ico: "🎨", titel: s.kunde || "Graffiti-Termin",
          von: iso, bis: iso, zeit,
          sub: (s.adresse || "").split("\n")[0] || "Graffiti",
          ziel: "mitarbeiter.html",
        });
      });
    })());
  }

  // --- Rundgänge (Check-ins) ---------------------------------------------------
  // Wiederkehrende Rundgänge an festen Wochentagen: für den angezeigten Monat
  // aufgelöst. Nur die, die diesem Mitarbeiter zugewiesen sind (oder allen).
  if (oneUser.zugang_checkin === true) {
    aufgaben.push((async () => {
      const m = oneKalMonatJetzt();
      const vonIso = glasIsoFromDate(new Date(m.jahr, m.monat, 1));
      const bisIso = glasIsoFromDate(new Date(m.jahr, m.monat + 1, 0));
      // Rundgänge + die eigenen Check-ins des Monats gemeinsam laden. Aus den Logs
      // ergibt sich, welche Rundgänge an welchem Tag schon erledigt wurden.
      const [rRes, lRes] = await Promise.all([
        oneKalMitTimeout(sb.from("checkin_rundgaenge").select("id, name, mitarbeiter_id, mitarbeiter_ids, tage, fenster_von, fenster_bis, aktiv, punkte")),
        oneKalMitTimeout(sb.from("checkin_logs").select("rundgang_id, datum, mitarbeiter_id")
          .eq("mitarbeiter_id", ich).gte("datum", vonIso).lte("datum", bisIso)).catch(() => ({ data: [] })),
      ]);
      const data = rRes.data;
      const logs = (lRes && lRes.data) || [];
      // "rundgang_id|datum" -> Anzahl abgehakter Punkte an dem Tag
      const erledigt = new Map();
      logs.forEach((l) => {
        if (!l.rundgang_id || !l.datum) return;
        const k = l.rundgang_id + "|" + l.datum;
        erledigt.set(k, (erledigt.get(k) || 0) + 1);
      });
      const letzter = new Date(m.jahr, m.monat + 1, 0).getDate();
      (data || []).forEach((r) => {
        if (r.aktiv === false) return;
        // Zuweisung: neue Liste (mitarbeiter_ids) hat Vorrang, sonst Einzelfeld.
        let ids = [];
        try { ids = Array.isArray(r.mitarbeiter_ids) ? r.mitarbeiter_ids : JSON.parse(r.mitarbeiter_ids || "[]"); } catch (e) { ids = []; }
        const fuerAlle = !ids.length && !r.mitarbeiter_id;
        const meiner = ids.includes(ich) || r.mitarbeiter_id === ich;
        if (!fuerAlle && !meiner) return;
        const tage = String(r.tage || "").split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => x >= 1 && x <= 7);
        for (let tag = 1; tag <= letzter; tag++) {
          const d = new Date(m.jahr, m.monat, tag);
          const wt = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mo … 7=So
          if (!tage.includes(wt)) continue;
          const iso = glasIsoFromDate(d);
          // Wie viele Punkte hat der Rundgang, und wie viele davon sind an dem Tag
          // schon abgehakt? Daraus ergibt sich "erledigt" bzw. "teilweise".
          let punkte = [];
          try { punkte = Array.isArray(r.punkte) ? r.punkte : JSON.parse(r.punkte || "[]"); } catch (e) { punkte = []; }
          const gemacht = erledigt.get(r.id + "|" + iso) || 0;
          const fertig = punkte.length > 0 && gemacht >= punkte.length;
          const teilweise = gemacht > 0 && !fertig;
          eintraege.push({
            art: "checkin", ico: fertig ? "✅" : "📍", titel: r.name || "Rundgang",
            von: iso, bis: iso, zeit: r.fenster_von || "",
            sub: fertig
              ? `Rundgang · erledigt${punkte.length ? ` (${gemacht}/${punkte.length})` : ""}`
              : teilweise
                ? `Rundgang · ${gemacht}/${punkte.length} erledigt`
                : `Rundgang · ${r.fenster_von || "?"}–${r.fenster_bis || "?"}`,
            ziel: "checkins-ma.html", tage, fertig,
          });
        }
      });
    })());
  }

  // --- Eigener Urlaub (NUR der eigene - Datenschutz) ----------------------------
  aufgaben.push((async () => {
    // Mit Status; fehlt die Spalte noch (SQL nicht ausgeführt), ohne sie laden.
    let res = await oneKalMitTimeout(sb.from("glas_urlaub").select("id, von, bis, notiz, mitarbeiter_id, status, antwort").eq("mitarbeiter_id", ich));
    if (res.error && /(status|antwort)/i.test(res.error.message || "")) {
      res = await oneKalMitTimeout(sb.from("glas_urlaub").select("id, von, bis, notiz, mitarbeiter_id").eq("mitarbeiter_id", ich));
    }
    (res.data || []).forEach((u) => {
      if (!u.von) return;
      const st = u.status || "genehmigt";
      if (st === "abgelehnt") return; // abgelehnte Anträge nicht als Termin zeigen
      eintraege.push({
        art: "urlaub", ico: st === "offen" ? "⏳" : "🏖️",
        titel: st === "offen" ? "Urlaub beantragt" : "Urlaub",
        von: u.von, bis: u.bis || u.von,
        sub: st === "offen" ? "Wartet auf das Büro" : (u.notiz || "Dein Urlaub"),
        ziel: null, offen: st === "offen",
      });
    });
  })());

  const ergebnisse = await Promise.allSettled(aufgaben);
  oneKalFehler = ergebnisse.some((r) => r.status === "rejected") ? "Ein Teil der Termine konnte nicht geladen werden." : "";
  eintraege.sort((a, b) => (a.von === b.von ? (a.zeit || "").localeCompare(b.zeit || "") : a.von.localeCompare(b.von)));
  oneKalTermine = eintraege;
}

// Startet das Laden GENAU EINMAL und zeichnet danach neu. Egal was passiert (Fehler,
// Zeitüberschreitung), am Ende steht ein Array in oneKalTermine - der Ladekreis
// verschwindet also immer.
function oneKalStarteLaden() {
  if (oneKalLaeuft) return;
  oneKalLaeuft = true;
  if (oneMeineAntraege === null) oneLadeMeineAntraege(); // eigene Anträge parallel holen
  oneKalLaden()
    .catch(() => { oneKalTermine = oneKalTermine || []; oneKalFehler = "Termine konnten nicht geladen werden. Bitte erneut versuchen."; })
    .finally(() => { oneKalLaeuft = false; if (oneScreen === "kalender") renderOne(); });
}

// Vom "Aktualisieren"-Knopf: neu laden erzwingen.
function oneKalNeuLaden() {
  oneKalTermine = null;
  oneKalStarteLaden();
  renderOne();
}

// Alle Termine, die einen bestimmten Tag berühren (mehrtägige Touren zählen an jedem Tag)
function oneKalAmTag(iso) {
  return (oneKalTermine || []).filter((e) => e.von <= iso && iso <= (e.bis || e.von));
}

function oneKalMonatName(m) {
  return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][m];
}

function renderOneKalender() {
  if (oneKalTermine === null) {
    oneKalStarteLaden();
    return `<p class="muted" style="margin-top:20px;"><span class="spinner"></span> Lade deine Termine…</p>
      <p class="muted" style="margin-top:14px; font-size:12.5px;">Dauert es zu lange? <a href="#" onclick="event.preventDefault(); oneKalNeuLaden();" style="color:var(--blue);">Neu laden</a></p>`;
  }

  const m = oneKalMonatJetzt();
  const heute = oneKalHeute();
  const ersterTag = new Date(m.jahr, m.monat, 1);
  const letzterTag = new Date(m.jahr, m.monat + 1, 0).getDate();
  const startLuecke = (ersterTag.getDay() + 6) % 7; // Montag = 0

  // Monatsraster
  let zellen = "";
  for (let i = 0; i < startLuecke; i++) zellen += `<div class="okal-tag leer"></div>`;
  for (let tag = 1; tag <= letzterTag; tag++) {
    const iso = glasIsoFromDate(new Date(m.jahr, m.monat, tag));
    const eintraege = oneKalAmTag(iso);
    // Erledigte Einträge bekommen im Raster den grauen Punkt - so sieht man auf einen
    // Blick, welche Tage schon abgehakt sind.
    const arten = [...new Set(eintraege.map((e) => (e.fertig ? "erledigt" : e.art)))];
    zellen += `
      <button class="okal-tag${iso === heute ? " heute" : ""}${eintraege.length ? " hat" : ""}${iso === oneKalTagGewaehlt ? " gewaehlt" : ""}" onclick="oneKalTagWaehlen('${iso}')">
        <span class="okal-num">${tag}</span>
        <span class="okal-punkte">${arten.slice(0, 4).map((a) => `<i style="background:${ONE_KAL_FARBEN[a]}"></i>`).join("")}</span>
      </button>`;
  }

  // Kommende Termine (ab heute). Wiederkehrende Rundgänge werden dabei zusammengefasst:
  // Sonst stünde derselbe Rundgang 20x untereinander und würde Touren, Graffiti-Termine
  // und Urlaub verdrängen. Im Monatsraster bleiben trotzdem ALLE Tage markiert, und beim
  // Antippen eines Tages sieht man weiterhin alles, was an dem Tag ansteht.
  const gesehen = new Set();
  const kommend = (oneKalTermine || [])
    .filter((e) => (e.bis || e.von) >= heute)
    .filter((e) => {
      if (e.art !== "checkin") return true;
      if (gesehen.has(e.titel)) return false;
      gesehen.add(e.titel);
      return true;
    })
    .slice(0, 12);

  return `
    <div class="okal-kopf">
      <button class="btn btn-sm" onclick="oneKalBlaettern(-1)" aria-label="Vorheriger Monat">‹</button>
      <span style="flex:1; text-align:center; font-weight:700;">${oneKalMonatName(m.monat)} ${m.jahr}</span>
      <button class="btn btn-sm" onclick="oneKalNeuLaden()" aria-label="Aktualisieren" title="Aktualisieren">↻</button>
      <button class="btn btn-sm" onclick="oneKalBlaettern(1)" aria-label="Nächster Monat">›</button>
    </div>
    ${oneKalFehler ? `<p class="muted" style="margin:6px 2px; font-size:12.5px;">⚠️ ${escapeHtml(oneKalFehler)}</p>` : ""}
    <div class="okal-wochentage">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span>${w}</span>`).join("")}</div>
    <div class="okal-raster">${zellen}</div>

    <div class="okal-legende">
      ${oneUser.zugang_glas !== false ? `<span><i style="background:${ONE_KAL_FARBEN.glas}"></i>Glas-Touren</span>` : ""}
      ${oneUser.zugang_graffiti === true ? `<span><i style="background:${ONE_KAL_FARBEN.graffiti}"></i>Graffiti</span>` : ""}
      ${oneUser.zugang_checkin === true ? `<span><i style="background:${ONE_KAL_FARBEN.checkin}"></i>Rundgänge</span>` : ""}
      <span><i style="background:${ONE_KAL_FARBEN.urlaub}"></i>Dein Urlaub</span>
      ${oneUser.zugang_checkin === true ? `<span><i style="background:${ONE_KAL_FARBEN.erledigt}"></i>Erledigt</span>` : ""}
    </div>

    <button class="btn btn-sm" style="margin-top:14px;" onclick="oneUrlaubFormOeffnen()">🏖️ Urlaub beantragen</button>
    ${renderOneUrlaubForm()}
    ${renderOneMeineAntraege()}

    <p class="one-label">${oneKalTagGewaehlt ? "AM " + formatGlasDate(oneKalTagGewaehlt) : "KOMMENDE TERMINE"}</p>
    ${oneKalListe(oneKalTagGewaehlt ? oneKalAmTag(oneKalTagGewaehlt) : kommend, !oneKalTagGewaehlt)}
    ${oneKalTagGewaehlt ? `<button class="btn btn-sm" style="margin-top:10px;" onclick="oneKalTagGewaehlt=null; renderOne();">Alle kommenden zeigen</button>` : ""}`;
}

let oneKalTagGewaehlt = null;

/* ---------------- Urlaub beantragen ---------------- */

let oneUrlaubFormOffen = false;
let oneMeineAntraege = null; // eigene Anträge inkl. offener/abgelehnter (null = ungeladen)
let oneUrlaubBusy = false;

function oneUrlaubFormOeffnen() {
  oneUrlaubFormOffen = !oneUrlaubFormOffen;
  renderOne();
}

function renderOneUrlaubForm() {
  if (!oneUrlaubFormOffen) return "";
  const heute = oneKalHeute();
  return `
    <div class="card" style="margin-top:10px;">
      <p style="margin:0 0 10px; font-weight:700;">🏖️ Urlaub beantragen</p>
      <div id="url_err"></div>
      <div class="row" style="display:flex; gap:8px;">
        <div class="field" style="flex:1;"><label class="muted">Von</label>
          <input type="date" id="url_von" min="${heute}" value="${oneKalTagGewaehlt || ""}" style="font-size:16px;" /></div>
        <div class="field" style="flex:1;"><label class="muted">Bis</label>
          <input type="date" id="url_bis" min="${heute}" value="${oneKalTagGewaehlt || ""}" style="font-size:16px;" /></div>
      </div>
      <div class="field"><label class="muted">Notiz ans Büro (optional)</label>
        <input type="text" id="url_notiz" placeholder="z.B. Familienbesuch" style="font-size:16px;" /></div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm" onclick="oneUrlaubFormOffen=false; renderOne();">Abbrechen</button>
        <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="oneUrlaubSenden()" ${oneUrlaubBusy ? "disabled" : ""}>
          ${oneUrlaubBusy ? "Sende…" : "Antrag senden"}</button>
      </div>
      <p class="muted" style="margin:9px 0 0; font-size:12px;">Das Büro sieht deinen Antrag sofort und gibt ihn frei oder lehnt ab. Du siehst den Stand hier.</p>
    </div>`;
}

// Eigene Anträge (offen + abgelehnt) - genehmigte stehen ohnehin als Termin im Kalender.
function renderOneMeineAntraege() {
  const liste = (oneMeineAntraege || []).filter((u) => (u.status || "genehmigt") !== "genehmigt");
  if (!liste.length) return "";
  return `
    <p class="one-label">DEINE ANTRÄGE</p>
    ${liste.map((u) => {
      const offen = (u.status || "") === "offen";
      const zeit = u.bis && u.bis !== u.von ? `${formatGlasDate(u.von)} – ${formatGlasDate(u.bis)}` : formatGlasDate(u.von);
      return `<div class="okal-eintrag" style="cursor:default;">
        <span class="okal-strich" style="background:${offen ? "#b5730b" : "#b23a1e"}"></span>
        <span style="flex:1; min-width:0;">
          <b>${offen ? "⏳ Wartet auf Freigabe" : "❌ Abgelehnt"}</b>
          <span>${escapeHtml(zeit)}${u.notiz ? " · " + escapeHtml(u.notiz) : ""}</span>
          ${u.antwort ? `<span>Büro: ${escapeHtml(u.antwort)}</span>` : ""}
        </span>
        ${offen ? `<button class="btn btn-sm" style="align-self:center;" onclick="oneUrlaubZuruecknehmen('${u.id}')">Zurückziehen</button>` : ""}
      </div>`;
    }).join("")}`;
}

async function oneUrlaubSenden() {
  const von = document.getElementById("url_von")?.value || "";
  const bis = document.getElementById("url_bis")?.value || von;
  const notiz = (document.getElementById("url_notiz")?.value || "").trim();
  const fehler = (m) => { const el = document.getElementById("url_err"); if (el) el.innerHTML = `<div class="glas-login-err">${escapeHtml(m)}</div>`; };
  if (!von) { fehler("Bitte ein Von-Datum wählen."); return; }
  if (bis && bis < von) { fehler("Das Bis-Datum liegt vor dem Von-Datum."); return; }
  if (von < oneKalHeute()) { fehler("Urlaub kann nur ab heute beantragt werden."); return; }

  oneUrlaubBusy = true; renderOne();
  try {
    const zeile = {
      id: (typeof genCode === "function" ? genCode() : String(Date.now())),
      mitarbeiter_id: oneUser.id, von, bis: bis || von, notiz,
      status: "offen", beantragt_am: new Date().toISOString(),
    };
    let { error } = await sb.from("glas_urlaub").insert(zeile);
    if (error && /(status|beantragt_am)/i.test(error.message || "")) {
      showToast("Bitte supabase_add_urlaub_antrag.sql in Supabase ausführen – ohne sie kann das Büro Anträge nicht freigeben.");
      oneUrlaubBusy = false; renderOne(); return;
    }
    if (error) throw error;
    oneUrlaubFormOffen = false;
    oneKalTermine = null; oneMeineAntraege = null; // neu laden
    // Das Büro sofort benachrichtigen (Glas-Admin-App) - aber nur, wenn der Schalter
    // "Neue Urlaubsanträge" dort an ist. Läuft im Hintergrund: schlägt es fehl, ist der
    // Antrag trotzdem gestellt und steht im Admin in der Liste.
    try {
      const { data: eins } = await sb.from("glas_einstellungen").select("push_urlaub").eq("id", "default").limit(1);
      const an = !eins || !eins[0] || eins[0].push_urlaub !== false; // fehlt die Spalte -> an
      if (an) {
        const zeit = zeile.bis && zeile.bis !== zeile.von
          ? `${formatGlasDate(zeile.von)} – ${formatGlasDate(zeile.bis)}` : formatGlasDate(zeile.von);
        sb.functions.invoke("send-push", { body: {
          role: "glas",
          title: "🏖️ Neuer Urlaubsantrag",
          body: `${oneUser.name || oneUser.username}: ${zeit}${notiz ? " · " + notiz : ""}`,
          url: "/glas-admin.html#/tab/kalender",
        } }).catch(() => {});
      }
    } catch (e) {}
    showToast("Antrag gesendet – das Büro entscheidet zeitnah ✓");
  } catch (e) {
    fehler("Konnte nicht gesendet werden. Bitte Internet prüfen.");
  } finally {
    oneUrlaubBusy = false;
    renderOne();
  }
}

async function oneUrlaubZuruecknehmen(id) {
  try {
    const { error } = await sb.from("glas_urlaub").delete().eq("id", id).eq("mitarbeiter_id", oneUser.id);
    if (error) throw error;
    oneKalTermine = null; oneMeineAntraege = null;
    showToast("Antrag zurückgezogen");
    renderOne();
  } catch (e) { showToast("Konnte nicht zurückgezogen werden"); }
}

// Eigene Anträge laden (nur die eigenen - Datenschutz wie beim Urlaub selbst)
async function oneLadeMeineAntraege() {
  try {
    const { data, error } = await sb.from("glas_urlaub")
      .select("id, von, bis, notiz, status, antwort").eq("mitarbeiter_id", oneUser.id);
    oneMeineAntraege = error ? [] : (data || []);
  } catch (e) { oneMeineAntraege = []; }
}

function oneKalTagWaehlen(iso) {
  oneKalTagGewaehlt = oneKalTagGewaehlt === iso ? null : iso;
  renderOne();
}

// Wochentage eines wiederkehrenden Rundgangs kurz benennen ("Mo–Fr" bzw. "Mo, Mi, Fr")
function oneKalTageText(tage) {
  const namen = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const l = (tage || []).slice().sort((a, b) => a - b);
  if (!l.length) return "";
  const luecken = l.every((t, i) => i === 0 || t === l[i - 1] + 1);
  return luecken && l.length > 2 ? `${namen[l[0] - 1]}–${namen[l[l.length - 1] - 1]}` : l.map((t) => namen[t - 1]).join(", ");
}

function oneKalListe(eintraege, zusammengefasst) {
  if (!eintraege.length) return `<p class="muted" style="margin:10px 2px;">Keine Termine.</p>`;
  return eintraege.map((e) => {
    // Nur ARCHIVIERTE Touren lassen sich nicht mehr öffnen - dann kommt ein kurzer
    // Hinweis statt einer Navigation ins Leere. Alles andere (auch vergangene, aber
    // noch nicht archivierte Touren) bleibt normal anklickbar und springt direkt in
    // die jeweilige Tour bzw. den Schein.
    const ziel = e.abgelaufen ? null : e.ziel;
    const mehrtaegig = e.bis && e.bis !== e.von;
    // Zusammengefasste Rundgänge zeigen den Rhythmus statt eines einzelnen Datums
    const datum = (zusammengefasst && e.art === "checkin" && e.tage)
      ? `${oneKalTageText(e.tage)} · immer wieder`
      : mehrtaegig ? `${formatGlasDate(e.von)} – ${formatGlasDate(e.bis)}` : formatGlasDate(e.von);
    const inner = `
      <span class="okal-strich" style="background:${e.fertig ? ONE_KAL_FARBEN.erledigt : ONE_KAL_FARBEN[e.art]}"></span>
      <span style="flex:1; min-width:0;">
        <b${e.fertig ? ` class="okal-fertig"` : ""}>${e.ico} ${escapeHtml(e.titel)}</b>
        <span>${escapeHtml(e.sub)}${e.zeit ? " · " + escapeHtml(e.zeit) + " Uhr" : ""}</span>
        <span style="font-weight:600; color:var(--text-secondary);">${datum}</span>
      </span>
      ${ziel ? `<span class="m-pfeil">›</span>` : e.abgelaufen ? `<span class="okal-schloss">🔒</span>` : ""}`;
    if (ziel) return `<a class="okal-eintrag" href="${ziel}">${inner}</a>`;
    if (e.abgelaufen) return `<button class="okal-eintrag" style="opacity:.72;" onclick="oneKalAbgelaufen()">${inner}</button>`;
    return `<div class="okal-eintrag" style="cursor:default;">${inner}</div>`;
  }).join("");
}

// Kurzer Hinweis beim Antippen einer archivierten Tour - statt einer Navigation,
// die nur in einer leeren Liste enden würde.
function oneKalAbgelaufen() {
  showToast("🔒 Diese Tour ist abgeschlossen und kann nicht mehr geöffnet werden.");
}
