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


-- Kontrolle: alle geplanten Aufgaben
select jobname, schedule, active from cron.job order by jobname;


-- ============================================================================
-- Nachtrag: Erinnerung gezielt an bestimmte Personen
-- ============================================================================
-- Bisher ging die Erinnerung an jedes Gerät, das Glasreinigungs-Meldungen
-- empfängt. Damit man sie einzelnen Personen zuordnen kann, braucht ein
-- angemeldetes Gerät einen Bezug zum Konto - mitarbeiter_id reicht dafür
-- nicht, weil reine Verwaltungskonten gar keinen Mitarbeiter-Datensatz haben.
alter table push_subscriptions add column if not exists auth_user_id uuid;

-- Wer soll die Lager-Erinnerung bekommen? Liste von Konto-Nummern.
-- Leer oder NULL = alle, die Glasreinigungs-Meldungen empfangen (bisheriges
-- Verhalten, damit nach dem Einspielen nichts stillschweigend ausfällt).
alter table glas_einstellungen add column if not exists lager_erinnerung_an jsonb;

-- Kontrolle
select column_name, data_type
from information_schema.columns
where table_name = 'push_subscriptions' and column_name in ('auth_user_id', 'mitarbeiter_id')
order by column_name;
