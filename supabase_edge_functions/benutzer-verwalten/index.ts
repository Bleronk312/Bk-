// Supabase Edge Function: benutzer-verwalten
//
// Legt Anmeldekonten an, setzt Passwörter zurück, sperrt und entsperrt.
//
// WARUM ÜBERHAUPT EINE FUNCTION?
// Konten anlegen geht nur mit dem Service-Role-Schlüssel. Der darf NIEMALS in
// den Browser — wer ihn hat, kommt an jede Zeile jeder Tabelle, an RLS vorbei.
// Deshalb läuft das hier auf dem Server, und der Browser darf nur fragen.
//
// SICHERHEIT — der wichtigste Teil dieser Datei:
// Supabase prüft von sich aus nur, dass überhaupt ein gültiger Schlüssel dabei
// ist — und der anon-Schlüssel steht in js/config.js, ist also öffentlich. Diese
// Function MUSS deshalb selbst prüfen, WER da fragt. Genau das macht istAdmin():
// sie liest das mitgeschickte Konto-Token und verlangt geko_rolle == "admin"
// aus app_metadata (das kann nur der Server setzen, siehe Schritt-1-SQL).
// Ohne diese Prüfung könnte sich jeder Besucher selbst ein Admin-Konto anlegen.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Anmeldename -> interne Adresse. Die Mitarbeiter tippen weiterhin NUR ihren
// Benutzernamen; die Adresse hängt die App an. Sie muss keine Mails empfangen
// können (Bestätigung ist aus), soll aber zur Firma passen, damit im Supabase-
// Dashboard sofort erkennbar ist, worum es sich handelt.
const MAIL_DOMAIN = "ma.gekoclean.de";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const antwort = (daten: unknown, status = 200) =>
  new Response(JSON.stringify(daten), { status, headers: cors });

// Benutzername säubern: klein, ohne Leerzeichen, nur was in einer Adresse
// erlaubt ist. Verhindert zugleich, dass jemand über einen Namen wie
// "x@fremd.de" eine fremde Adresse unterschiebt.
function nameSaeubern(roh: string): string {
  return String(roh || "")
    .trim().toLowerCase()
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9._-]/g, "");
}

const mailFuer = (benutzername: string) => `${benutzername}@${MAIL_DOMAIN}`;

// Ist der Aufrufer wirklich ein angemeldeter Admin?
async function istAdmin(req: Request, admin: ReturnType<typeof createClient>) {
  const kopf = req.headers.get("Authorization") || "";
  const token = kopf.replace(/^Bearer\s+/i, "").trim();
  // Der anon-Schlüssel ist öffentlich und wird von supabase-js als Authorization
  // geschickt, wenn niemand angemeldet ist. Der ist KEIN Konto-Token.
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  if ((data.user.app_metadata as Record<string, unknown> | null)?.geko_rolle !== "admin") return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const aufrufer = await istAdmin(req, admin);
  if (!aufrufer) return antwort({ error: "Nur für angemeldete Admins." }, 403);

  let eingabe: Record<string, string | boolean>;
  try {
    eingabe = await req.json();
  } catch {
    return antwort({ error: "Ungültige Anfrage." }, 400);
  }

  const aktion = String(eingabe.aktion || "");
  const maId = String(eingabe.mitarbeiter_id || "");     // glas_mitarbeiter.id
  const userId = String(eingabe.user_id || "");          // Konto OHNE Mitarbeiter (reine Admins)
  const benutzername = nameSaeubern(String(eingabe.benutzername || ""));
  const passwort = String(eingabe.passwort || "");
  const rolle = eingabe.rolle === "admin" ? "admin" : "mitarbeiter";

  // Zu welchem Konto gehört dieser Mitarbeiter?
  // Bewusst "*" statt einer festen Spaltenliste: die Tabelle ist über viele
  // Zusatz-Skripte gewachsen und sieht nicht in jeder Installation gleich aus.
  // Eine einzige fehlende Spalte würde sonst die ganze Abfrage scheitern lassen.
  async function kontoVon(id: string) {
    const { data, error } = await admin.from("glas_mitarbeiter")
      .select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("Mitarbeiter lesen: " + error.message);
    // deno-lint-ignore no-explicit-any
    return data as Record<string, any> | null;
  }

  // Wen betrifft die Aktion? Entweder ein Mitarbeiter (mitarbeiter_id) oder
  // ein freistehendes Admin-Konto (user_id).
  async function ziel(): Promise<{ ma: Record<string, unknown> | null; uid: string | null }> {
    if (maId) {
      const ma = await kontoVon(maId);
      return { ma, uid: (ma?.auth_user_id as string) || null };
    }
    if (userId) return { ma: null, uid: userId };
    return { ma: null, uid: null };
  }

  try {
    switch (aktion) {

      // ---- Admin-Konto OHNE Mitarbeiter anlegen (z.B. Buerokraft) ---------
      case "admin_anlegen": {
        const roh = String(eingabe.benutzername || "").trim();
        if (!roh || passwort.length < 8) {
          return antwort({ error: "Benutzername (oder E-Mail) und ein Passwort mit mindestens 8 Zeichen sind Pflicht." }, 400);
        }
        // Echte E-Mail-Adressen sind fuer Admins erlaubt und praktisch
        // (Anmeldung mit der Adresse); sonst Benutzername wie bei Mitarbeitern.
        const mail = roh.includes("@") ? roh.toLowerCase() : mailFuer(nameSaeubern(roh));
        const { data, error } = await admin.auth.admin.createUser({
          email: mail,
          password: passwort,
          email_confirm: true,
          app_metadata: { geko_rolle: "admin" },
          user_metadata: { name: String(eingabe.name || roh) },
        });
        if (error) {
          const doppelt = /already|registered|exists/i.test(error.message || "");
          return antwort({ error: doppelt ? "Diesen Benutzernamen gibt es schon." : error.message }, doppelt ? 409 : 400);
        }
        return antwort({ ok: true, benutzername: roh, email: mail, user_id: data.user.id });
      }

      // ---- Konto anlegen -------------------------------------------------
      case "anlegen": {
        if (!maId || !benutzername || passwort.length < 8) {
          return antwort({ error: "Mitarbeiter, Benutzername und ein Passwort mit mindestens 8 Zeichen sind Pflicht." }, 400);
        }
        const ma = await kontoVon(maId);
        if (!ma) return antwort({ error: "Diesen Mitarbeiter gibt es nicht." }, 404);
        if (ma.auth_user_id) return antwort({ error: "Für diesen Mitarbeiter gibt es schon ein Konto." }, 409);

        const { data, error } = await admin.auth.admin.createUser({
          email: mailFuer(benutzername),
          password: passwort,
          email_confirm: true,                       // keine Bestätigungsmail nötig
          app_metadata: { geko_rolle: rolle, mitarbeiter_id: maId },
          user_metadata: { name: ma.name || benutzername },
        });
        if (error) {
          // Häufigster Fall: Benutzername schon vergeben — klar benennen,
          // statt eine englische Rohmeldung durchzureichen.
          const doppelt = /already|registered|exists/i.test(error.message || "");
          return antwort({ error: doppelt ? "Diesen Benutzernamen gibt es schon." : error.message }, doppelt ? 409 : 400);
        }

        // Verknüpfen. Klappt das nicht, wird das Konto wieder entfernt —
        // sonst bliebe ein Konto ohne Mitarbeiter übrig, das sich anmelden
        // könnte, aber nirgends zugeordnet wäre.
        const { error: verknuepft } = await admin.from("glas_mitarbeiter")
          .update({ auth_user_id: data.user.id, username: benutzername, login_aktiv: true, pw_muss_wechsel: true })
          .eq("id", maId);
        if (verknuepft) {
          await admin.auth.admin.deleteUser(data.user.id);
          return antwort({ error: "Konto konnte nicht zugeordnet werden: " + verknuepft.message }, 500);
        }
        return antwort({ ok: true, benutzername, user_id: data.user.id });
      }

      // ---- Passwort neu setzen -------------------------------------------
      case "passwort_neu": {
        if (passwort.length < 8) return antwort({ error: "Das Passwort braucht mindestens 8 Zeichen." }, 400);
        const z = await ziel();
        if (!z.uid) return antwort({ error: "Für diesen Eintrag gibt es noch kein Konto." }, 404);
        const { error } = await admin.auth.admin.updateUserById(z.uid, { password: passwort });
        if (error) return antwort({ error: error.message }, 400);
        // Mitarbeiter muessen sich beim naechsten Anmelden ein eigenes setzen.
        if (z.ma) await admin.from("glas_mitarbeiter").update({ pw_muss_wechsel: true }).eq("id", maId);
        return antwort({ ok: true });
      }

      // ---- Sperren / entsperren ------------------------------------------
      // Gesperrt = darf sich nicht mehr anmelden, aber alle Daten (Touren,
      // Unterschriften, Urlaub) bleiben erhalten. Genau das will man, wenn
      // jemand die Firma verlässt — löschen würde die Historie mitreißen.
      case "sperren":
      case "entsperren": {
        const z = await ziel();
        if (!z.uid) return antwort({ error: "Für diesen Eintrag gibt es noch kein Konto." }, 404);
        const sperren = aktion === "sperren";
        if (sperren && z.uid === aufrufer.id) return antwort({ error: "Du kannst dich nicht selbst sperren." }, 400);
        const { error } = await admin.auth.admin.updateUserById(z.uid, {
          ban_duration: sperren ? "876000h" : "none",   // ~100 Jahre bzw. Sperre aufheben
        });
        if (error) return antwort({ error: error.message }, 400);
        if (z.ma) await admin.from("glas_mitarbeiter").update({ login_aktiv: !sperren }).eq("id", maId);
        return antwort({ ok: true, login_aktiv: !sperren });
      }

      // ---- Rolle ändern ---------------------------------------------------
      case "rolle_setzen": {
        const ma = await kontoVon(maId);
        if (!ma?.auth_user_id) return antwort({ error: "Für diesen Mitarbeiter gibt es noch kein Konto." }, 404);
        // Sich selbst die Admin-Rolle zu nehmen wäre eine Falle: dann käme
        // womöglich niemand mehr an die Benutzerverwaltung.
        if (ma.auth_user_id === aufrufer.id && rolle !== "admin") {
          return antwort({ error: "Du kannst dir die Admin-Rolle nicht selbst wegnehmen." }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(ma.auth_user_id, {
          app_metadata: { geko_rolle: rolle, mitarbeiter_id: maId },
        });
        if (error) return antwort({ error: error.message }, 400);
        return antwort({ ok: true, rolle });
      }

      // ---- Konto löschen (Mitarbeiter-Datensatz bleibt!) -------------------
      case "konto_loeschen": {
        const z = await ziel();
        if (!z.uid) return antwort({ error: "Für diesen Eintrag gibt es kein Konto." }, 404);
        if (z.uid === aufrufer.id) return antwort({ error: "Du kannst dein eigenes Konto nicht löschen." }, 400);
        const { error } = await admin.auth.admin.deleteUser(z.uid);
        if (error) return antwort({ error: error.message }, 400);
        if (z.ma) await admin.from("glas_mitarbeiter")
          .update({ auth_user_id: null, login_aktiv: false }).eq("id", maId);
        return antwort({ ok: true });
      }

      // ---- Übersicht für die Admin-Oberfläche ------------------------------
      case "liste": {
        // "*" statt fester Spalten, siehe kontoVon(). Zurückgegeben wird
        // trotzdem nur das Nötige — pass_klar und pass_hash haben im Browser
        // nichts verloren, auch nicht beim Admin.
        const { data, error } = await admin.from("glas_mitarbeiter").select("*").order("name");
        if (error) return antwort({ error: "Mitarbeiterliste: " + error.message }, 500);

        const { data: konten, error: kontenFehler } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (kontenFehler) return antwort({ error: "Konten lesen: " + kontenFehler.message }, 500);

        const rollen = new Map(
          (konten?.users || []).map((u) => [u.id, String((u.app_metadata as Record<string, unknown>)?.geko_rolle || "mitarbeiter")]),
        );
        const liste = (data || []) as Record<string, unknown>[];
        // Konten, die zu KEINEM Mitarbeiter gehoeren (reine Verwaltungskonten,
        // z.B. das erste Admin-Konto oder Buerokraefte).
        const verknuepft = new Set(liste.map((m) => m.auth_user_id).filter(Boolean));
        const freie = (konten?.users || [])
          .filter((u) => !verknuepft.has(u.id))
          .map((u) => ({
            user_id: u.id,
            email: u.email || "",
            name: String((u.user_metadata as Record<string, unknown>)?.name || u.email || ""),
            rolle: rollen.get(u.id) || "mitarbeiter",
            gesperrt: !!(u as unknown as { banned_until?: string }).banned_until
              && new Date((u as unknown as { banned_until: string }).banned_until) > new Date(),
          }));
        return antwort({
          ok: true,
          gesamt: liste.length,
          admins_ohne_mitarbeiter: freie,
          mitarbeiter: liste.map((m) => ({
            id: m.id,
            name: m.name ?? "",
            username: m.username ?? null,
            login_aktiv: m.login_aktiv ?? true,
            pw_muss_wechsel: m.pw_muss_wechsel ?? false,
            hat_konto: !!m.auth_user_id,
            rolle: m.auth_user_id ? rollen.get(m.auth_user_id as string) || "mitarbeiter" : null,
          })),
        });
      }

      default:
        return antwort({ error: "Unbekannte Aktion." }, 400);
    }
  } catch (e) {
    console.error("benutzer-verwalten:", e);
    return antwort({ error: (e as Error)?.message || "Unerwarteter Fehler." }, 500);
  }
});
