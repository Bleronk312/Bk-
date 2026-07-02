-- Aktiviert die nötigen Erweiterungen für automatische, tägliche Ausführung
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Plant den täglichen Aufruf der "daily-reminders" Edge Function um 8:00 Uhr deutscher Zeit.
-- Hinweis: pg_cron rechnet in UTC. 6:00 UTC entspricht 8:00 Uhr deutscher Sommerzeit (die meiste
-- Zeit des Jahres). Im Winter (Normalzeit) verschiebt sich das dadurch auf 7:00 Uhr deutscher Zeit.
-- Falls gewünscht, kannst du das unten in der Zeile "6 * * *" anpassen (z.B. auf "7 * * *" für Winterzeit).

select cron.schedule(
  'daily-termin-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://tjeheehmaefrqutbjmxn.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZWhlZWhtYWVmcnF1dGJqbXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjI5NDcsImV4cCI6MjA5NzgzODk0N30.MqRoBOAI480n6nH4z_tF5aLPp8v8ZEa0Q-ekcNgw-bM'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Zur Kontrolle: zeigt alle geplanten Aufgaben an
select * from cron.job;
