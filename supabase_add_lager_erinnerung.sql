-- ============================================================================
-- GEKO · Lager: Erinnerung ans Verschicken + Bestätigungs-Meldungen
-- ============================================================================
-- Gefahrlos ausführbar, ändert nichts am laufenden Betrieb.
-- ============================================================================

-- Um wie viel Uhr soll das Büro erinnert werden, falls der Lager-Plan für den
-- nächsten Tag noch nicht raus ist? Format "HH:MM" (Berliner Zeit).
-- NULL = keine Erinnerung.
alter table glas_einstellungen add column if not exists lager_erinnerung_zeit text;

-- Damit die Erinnerung nicht mehrfach am selben Tag kommt, falls der
-- Zeitplan einmal doppelt anläuft.
alter table glas_einstellungen add column if not exists lager_erinnerung_zuletzt date;

-- Standard: 18:00 Uhr. Wer das nicht will, stellt es in den Einstellungen ab.
update glas_einstellungen
   set lager_erinnerung_zeit = '18:00'
 where id = 'default' and lager_erinnerung_zeit is null;

-- Zeile anlegen, falls es sie noch gar nicht gibt
insert into glas_einstellungen (id, lager_erinnerung_zeit)
select 'default', '18:00'
where not exists (select 1 from glas_einstellungen where id = 'default');


-- ---------------------------------------------------------------------------
-- Zeitplan: stündlich nachsehen, ob die eingestellte Uhrzeit erreicht ist
-- ---------------------------------------------------------------------------
-- Die Edge Function entscheidet selbst, ob sie etwas tut - deshalb kann der
-- Zeitplan stumpf jede Stunde laufen. Nur so lässt sich die Uhrzeit in der App
-- einstellen, ohne jedes Mal den Zeitplan in der Datenbank zu ändern.
--
-- WICHTIG: DEIN-PROJEKT und DEIN-ANON-KEY unten durch die echten Werte
-- ersetzen (dieselben wie in js/config.js).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('geko-lager-erinnerung')
where exists (select 1 from cron.job where jobname = 'geko-lager-erinnerung');

select cron.schedule(
  'geko-lager-erinnerung',
  '5 * * * *',                    -- jede Stunde um :05
  $$
  select net.http_post(
    url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/lager-erinnerung',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer DEIN-ANON-KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ---------------------------------------------------------------------------
-- Nebenbefund: der bestehende 8-Uhr-Zeitplan steht falsch
-- ---------------------------------------------------------------------------
-- In supabase_cron_setup.sql steht '6 * * *' - das sind nur VIER Felder.
-- Ein Zeitplan braucht fünf (Minute Stunde Tag Monat Wochentag). Gemeint war
-- 6:00 UTC, also '0 6 * * *'.
-- Prüf mit der Abfrage unten, was bei dir eingetragen ist. Steht dort etwas
-- anderes als '0 6 * * *', dann diesen Block ausführen:

-- select cron.unschedule('daily-termin-reminders');
-- select cron.schedule(
--   'daily-termin-reminders',
--   '0 6 * * *',
--   $$
--   select net.http_post(
--     url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/daily-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer DEIN-ANON-KEY'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Kontrolle: alle geplanten Aufgaben
select jobname, schedule, active from cron.job order by jobname;
