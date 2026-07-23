-- ============================================================================
-- Plant die Auscheck-Erinnerungen: ruft die Edge Function "checkin-reminders"
-- alle 5 Minuten auf. Voraussetzung: die Function ist deployt und
-- supabase_add_checkin_push.sql wurde ausgeführt.
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Falls schon vorhanden, zuerst entfernen (macht das Skript wiederholbar).
select cron.unschedule('checkin-abmelde-erinnerungen')
where exists (select 1 from cron.job where jobname = 'checkin-abmelde-erinnerungen');

select cron.schedule(
  'checkin-abmelde-erinnerungen',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://tjeheehmaefrqutbjmxn.supabase.co/functions/v1/checkin-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZWhlZWhtYWVmcnF1dGJqbXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjI5NDcsImV4cCI6MjA5NzgzODk0N30.MqRoBOAI480n6nH4z_tF5aLPp8v8ZEa0Q-ekcNgw-bM'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Zur Kontrolle:
select * from cron.job where jobname = 'checkin-abmelde-erinnerungen';
