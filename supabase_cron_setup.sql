-- Aktiviert die nötigen Erweiterungen für automatische, tägliche Ausführung
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Plant den täglichen Aufruf der "daily-reminders" Edge Function um 8:00 Uhr deutscher Zeit.
-- Hinweis: pg_cron rechnet in UTC. 6:00 UTC entspricht 8:00 Uhr deutscher Sommerzeit (die meiste
-- Zeit des Jahres). Im Winter (Normalzeit) verschiebt sich das dadurch auf 7:00 Uhr deutscher Zeit.
-- Falls gewünscht, kannst du das unten in der Zeile "0 6 * * *" anpassen (z.B. auf "0 7 * * *" für Winterzeit).
-- Aufbau: Minute Stunde Tag Monat Wochentag - fünf Felder, nicht vier.
--
-- WICHTIG: Ersetze DEIN-PROJEKT und DEIN-ANON-KEY unten mit deinen echten Werten,
-- bevor du dieses Skript ausführst.

select cron.schedule(
  'daily-termin-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer DEIN-ANON-KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Zur Kontrolle: zeigt alle geplanten Aufgaben an
select * from cron.job;
