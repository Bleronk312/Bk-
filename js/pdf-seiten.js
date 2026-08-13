// ============================================================================
// PDF-Seiten als Bilder
//
// Die Vorher-/Nachher-Fotos landen spaeter im Abnahmeschein-PDF und werden dort
// als BILD eingebettet. Eine PDF-Datei laesst sich nicht als Bild einbetten -
// darum wandeln wir beim Auswaehlen jede Seite des PDFs in ein JPG um. Danach
// verhaelt sich alles wie ein normales Foto: Vorschau, Speichern, PDF-Export.
//
// pdf.js liegt bewusst LOKAL im Ordner vendor/pdfjs (nicht per CDN):
//   - die Adresse kann sich nicht aendern und nichts kann von aussen wegbrechen,
//   - es wird ERST GELADEN, wenn wirklich jemand ein PDF auswaehlt. Wer nur Fotos
//     hochlaedt, laedt die 1,4 MB nie mit.
// Bewusst die "legacy"-Fassung von pdf.js 3: die laeuft auch auf aelteren
// iPhones/Android-Browsern, waehrend die neue Fassung reine ES-Module braucht.
// ============================================================================

let gekoPdfLadeVersprechen = null;

function gekoPdfBasis() {
  // Pfad relativ zur Seite - funktioniert auf der Live-Adresse genauso wie im Test.
  return "vendor/pdfjs/";
}

// Laedt pdf.js einmalig nach. Mehrfache Aufrufe warten auf dasselbe Versprechen.
function gekoLadePdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (gekoPdfLadeVersprechen) return gekoPdfLadeVersprechen;
  gekoPdfLadeVersprechen = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = gekoPdfBasis() + "pdf.min.js";
    s.onload = () => {
      if (!window.pdfjsLib) { reject(new Error("pdf.js nicht verfügbar")); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = gekoPdfBasis() + "pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { gekoPdfLadeVersprechen = null; reject(new Error("pdf.js konnte nicht geladen werden")); };
    document.head.appendChild(s);
  });
  return gekoPdfLadeVersprechen;
}

function gekoIstPdf(file) {
  if (!file) return false;
  const typ = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return typ === "application/pdf" || name.endsWith(".pdf");
}

// Wandelt die Seiten eines PDFs in JPG-dataURLs um.
//   file      - die PDF-Datei
//   maxSeiten - hoechstens so viele Seiten (Rest wird ausgelassen)
//   maxKante  - laengste Bildkante in Pixeln (wie bei den Fotos)
//   guete     - JPEG-Qualitaet
// Rueckgabe: { bilder: [dataURL, ...], seitenGesamt: n }
async function gekoPdfSeitenAlsBilder(file, maxSeiten, maxKante, guete) {
  const grenze = maxSeiten && maxSeiten > 0 ? maxSeiten : 10;
  const kante = maxKante || 900;
  const q = guete || 0.65;
  const lib = await gekoLadePdfJs();
  const buf = await file.arrayBuffer();
  // isEvalSupported:false - keine dynamische Code-Auswertung, vertraegt sich mit
  // strengen Sicherheitsregeln im Browser.
  const doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const bilder = [];
  const seitenGesamt = doc.numPages;
  const anzahl = Math.min(seitenGesamt, grenze);
  for (let nr = 1; nr <= anzahl; nr++) {
    const seite = await doc.getPage(nr);
    const roh = seite.getViewport({ scale: 1 });
    // So skalieren, dass die laengste Kante der Foto-Groesse entspricht. Nie
    // vergroessern (Faktor hoechstens 1), sonst wird ein kleines PDF unscharf aufgeblasen.
    const faktor = Math.min(kante / Math.max(roh.width, roh.height), 1) || 1;
    const viewport = seite.getViewport({ scale: faktor });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    // Weisser Grund: PDF-Seiten sind durchsichtig, sonst wird das JPG schwarz.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await seite.render({ canvasContext: ctx, viewport }).promise;
    bilder.push(canvas.toDataURL("image/jpeg", q));
    if (typeof seite.cleanup === "function") seite.cleanup();
  }
  try { doc.destroy(); } catch (e) {}
  return { bilder, seitenGesamt };
}
