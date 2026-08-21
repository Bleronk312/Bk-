-- ============================================================================
-- GEKO · Die automatischen Erinnerungen gegen Missbrauch absichern
-- ============================================================================
-- WAS WAR DAS PROBLEM?
-- Drei Edge Functions laufen nach Zeitplan und verschicken Benachrichtigungen
-- an die ganze Belegschaft: daily-reminders, checkin-reminders und
-- lager-erinnerung. Keine davon hat geprüft, WER sie startet.
--
-- Supabase lässt aber jeden durch, der irgendeinen gültigen Schlüssel
-- mitschickt - und der öffentliche Schlüssel steht in js/config.js. Wer die
-- Adresse kannte, konnte die Handys aller Mitarbeiter im Sekundentakt klingeln
-- lassen. Kein Datenverlust, aber die App wäre nach einem Tag unbenutzbar,
-- weil jeder die Benachrichtigungen abschaltet - und genau davon lebt sie.
--
-- ----------------------------------------------------------------------------
-- ZWEI SCHRITTE, UND DIE REIHENFOLGE ZÄHLT
--
-- Die neue Fassung der Functions ist absichtlich NACHSICHTIG, solange das
-- Geheimnis nicht gesetzt ist: dann läuft alles wie bisher. Dadurch kann
-- nichts kaputtgehen, egal in welcher Reihenfolge du arbeitest - die
-- Erinnerungen fallen zwischendurch nicht aus.
--
--   1. Die drei Functions neu deployen (die Fassung mit der Wache).
--   2. Im Supabase-Dashboard unter Edge Functions -> Secrets ein neues
--      Geheimnis anlegen:
--
--          Name:  GEKO_CRON_SECRET
--          Wert:  eine lange Zufallsfolge, z.B. mit
--                 select encode(gen_random_bytes(32), 'hex');
--
--   3. Dieses Skript ausführen - es trägt das Geheimnis in die Zeitpläne ein.
--
-- Erst nach Schritt 3 ist die Tür wirklich zu.
--
-- ⚠️  UNTEN DREI PLATZHALTER ERSETZEN, bevor du es ausführst:
--       DEIN-PROJEKT       -> deine Projekt-Kennung (steht in js/config.js)
--       DEIN-ANON-KEY      -> der öffentliche Schlüssel (steht dort ebenfalls)
--       DEIN-CRON-GEHEIMNIS-> genau der Wert aus Schritt 2
-- ============================================================================


-- Zur Sicherheit: erst anschauen, was gerade läuft. Namen und Uhrzeiten
-- notieren, falls sie bei dir von den unten stehenden abweichen.
select jobname, schedule, active from cron.job order by jobname;


-- ---------------------------------------------------------------------------
-- Alte Zeitpläne entfernen und mit dem Geheimnis im Kopf neu anlegen.
-- (unschedule schlägt fehl, wenn es den Namen nicht gibt - deshalb einzeln
--  und mit Abfangen, damit das Skript in jedem Fall durchläuft.)
-- ---------------------------------------------------------------------------
do $$
declare n text;
begin
  foreach n in array array['daily-termin-reminders',
                           'checkin-abmelde-erinnerungen',
                           'geko-lager-erinnerung']
  loop
    begin
      perform cron.unschedule(n);
    exception when others then
      raise notice 'Zeitplan % gab es nicht - übersprungen', n;
    end;
  end loop;
end $$;


-- 1) Tägliche Termin-Übersicht, 6:00 UTC
select cron.schedule(
  'daily-termin-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer DEIN-ANON-KEY',
      'x-geko-cron', 'DEIN-CRON-GEHEIMNIS'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2) Erinnerung ans Auschecken, alle 5 Minuten
select cron.schedule(
  'checkin-abmelde-erinnerungen',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/checkin-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer DEIN-ANON-KEY',
      'x-geko-cron', 'DEIN-CRON-GEHEIMNIS'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3) Lager-Plan-Erinnerung, stündlich (die Function entscheidet selbst,
--    ob gerade die eingestellte Uhrzeit ist)
select cron.schedule(
  'geko-lager-erinnerung',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/lager-erinnerung',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer DEIN-ANON-KEY',
      'x-geko-cron', 'DEIN-CRON-GEHEIMNIS'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ---------------------------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------------------------
-- Erwartet: drei Zeilen, alle active = true.
select jobname, schedule, active from cron.job order by jobname;

-- Und nach der nächsten fälligen Ausführung hier nachsehen: status muss
-- 'succeeded' sein. Steht dort eine 403, stimmt das Geheimnis im Zeitplan
-- nicht mit dem im Secret überein.
-- select jobname, status, start_time, return_message
--   from cron.job_run_details order by start_time desc limit 10;
