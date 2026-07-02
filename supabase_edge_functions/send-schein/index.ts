// Supabase Edge Function: send-schein
// Verschickt einen unterschriebenen Abnahmeschein (PDF) per E-Mail über Resend
// (https://resend.com). Wird direkt nach der Unterschrift aufgerufen, wenn im
// Formular eine Empfänger-Adresse eingetragen wurde.
//
// Benötigte Secrets (Edge Functions -> Secrets):
//   RESEND_API_KEY  - API-Key aus dem Resend-Dashboard (Pflicht)
//   MAIL_FROM       - Absender, z.B.  GEKO Clean <scheine@gekoclean.de>
//                     (Domain muss in Resend verifiziert sein; ohne eigenes Secret wird
//                     der Resend-Testabsender genutzt, der nur an die eigene
//                     Registrierungs-Adresse zustellen darf)
//   MAIL_BCC        - optional: Adresse, die von jedem Versand eine Blindkopie bekommt
//                     (z.B. euer Büro-Postfach als automatische Ablage)

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "GEKO Clean <onboarding@resend.dev>";
const MAIL_BCC = Deno.env.get("MAIL_BCC") || "";

// Base64-PDF-Anhang: großzügiges, aber hartes Limit gegen Missbrauch/Fehler
const MAX_PDF_BASE64_CHARS = 8_000_000; // ~6 MB PDF

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function istGueltigeEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY fehlt als Secret");
      return jsonResponse(500, { error: "RESEND_API_KEY ist nicht als Secret hinterlegt" });
    }

    const { to, subject, text, filename, pdfBase64 } = await req.json();

    if (!istGueltigeEmail(to)) {
      return jsonResponse(400, { error: "Ungültige Empfänger-Adresse" });
    }
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return jsonResponse(400, { error: "pdfBase64 fehlt" });
    }
    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return jsonResponse(400, { error: "PDF ist zu groß für den Versand" });
    }

    const safeFilename = String(filename || "Abnahmeschein.pdf").replace(/[^\w.\-äöüÄÖÜß ]+/g, "_").slice(0, 120);
    const safeSubject = String(subject || "Ihr Leistungsnachweis").slice(0, 200);
    const safeText = String(
      text ||
      "Guten Tag,\n\nanbei erhalten Sie Ihren unterschriebenen Leistungsnachweis als PDF.\n\nMit freundlichen Grüßen\nGEKO Clean"
    ).slice(0, 5000);

    const payload: Record<string, unknown> = {
      from: MAIL_FROM,
      to: [to.trim()],
      subject: safeSubject,
      text: safeText,
      attachments: [{ filename: safeFilename, content: pdfBase64 }],
    };
    if (MAIL_BCC && istGueltigeEmail(MAIL_BCC)) payload.bcc = [MAIL_BCC.trim()];

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend-Fehler:", res.status, JSON.stringify(result));
      return jsonResponse(502, { error: result?.message || `Mail-Dienst antwortete mit ${res.status}` });
    }

    return jsonResponse(200, { ok: true, id: result?.id || null });
  } catch (e) {
    console.error("Unerwarteter Fehler in send-schein:", e?.message || e, e?.stack || "");
    return jsonResponse(500, { error: String(e?.message || e) });
  }
});
