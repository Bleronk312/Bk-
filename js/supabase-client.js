// persistSession + autoRefreshToken: Die Anmeldung liegt dauerhaft im Browser
// und wird im Hintergrund verlaengert. Dadurch bleibt man angemeldet, bis man
// sich AKTIV abmeldet - auch nach Wochen ohne Oeffnen. Wichtig fuer die
// Mitarbeiter, die morgens am Objekt nicht erst ein Passwort suchen wollen.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "geko_auth",
  },
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
