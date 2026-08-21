-- ============================================================================
-- GEKO · Sicherheits-Zeugnis
-- ============================================================================
-- Liest nur, ändert nichts. Beliebig oft ausführbar.
--
-- Prüft in einem Rutsch, ob alles angekommen ist, was wir eingespielt haben.
-- Ergebnis ist eine Liste: in der Spalte "ergebnis" muss überall OK stehen.
-- Steht irgendwo PRUEFEN, sagt die Zeile daneben, was fehlt.
--
-- Was diese Abfrage NICHT sehen kann, weil es nicht in der Datenbank steht:
--   * ob die Edge Functions in der neuen Fassung deployt sind
--   * ob "Allow new users to sign up" in den Auth-Einstellungen aus ist
--   * ob GEKO_CRON_SECRET als Secret hinterlegt ist
-- Diese drei bitte im Dashboard nachsehen.
-- ============================================================================

with p as (

  -- 1) Jede Tabelle hat Zugriffsregeln -------------------------------------
  select 1 as nr, 'Alle Tabellen mit Regeln' as pruefpunkt,
         case when count(*) = 0 then 'OK' else 'PRUEFEN' end as ergebnis,
         case when count(*) = 0 then 'jede Tabelle ist geregelt'
              else 'ohne Regel: ' || string_agg(tablename, ', ') end as hinweis
    from (select t.tablename from pg_tables t
           where t.schemaname = 'public'
             and not exists (select 1 from pg_policies p
                              where p.schemaname = 'public' and p.tablename = t.tablename)) x

  union all
  -- 2) Keine Jedermann-Regeln mehr -----------------------------------------
  select 2, 'Keine offenen anon-Regeln',
         case when count(*) = 0 then 'OK' else 'PRUEFEN' end,
         case when count(*) = 0 then 'keine gefunden'
              else count(*) || ' Stueck: ' || string_agg(policyname, ', ') end
    from pg_policies
   where schemaname in ('public', 'storage') and policyname like 'anon%'

  union all
  -- 3) Der oeffentliche Schluessel darf nichts mehr -------------------------
  select 3, 'anon ohne Tabellenrechte',
         case when count(*) = 0 then 'OK' else 'PRUEFEN' end,
         case when count(*) = 0 then 'anon kommt an keine Tabelle'
              else count(*) || ' Rechte offen' end
    from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'

  union all
  -- 4) Alte Klartext-Passwoerter --------------------------------------------
  select 4, 'Alte Passwortspalten entfernt',
         case when count(*) = 0 then 'OK' else 'PRUEFEN' end,
         case when count(*) = 0 then 'pass_klar/pass_hash/pass_salt sind weg'
              else 'noch da: ' || string_agg(column_name, ', ') end
    from information_schema.columns
   where table_name = 'glas_mitarbeiter' and column_name like 'pass%'

  union all
  -- 5) Spalten-Waechter ------------------------------------------------------
  -- Erwartet: mitarbeiter, urlaub, stopps, scheine, lager, positionen
  select 5, 'Spalten-Waechter aktiv',
         case when count(*) >= 6 then 'OK' else 'PRUEFEN' end,
         count(*) || ' von 6 - ' || coalesce(string_agg(event_object_table, ', '), 'keiner')
    from information_schema.triggers
   where trigger_name like 'geko_schutz%'

  union all
  -- 6) Foto-Speicher ---------------------------------------------------------
  select 6, 'Foto-Speicher: Schreiben/Loeschen zu',
         case when count(*) filter (where policyname like 'geko_fotos%') >= 3
              then 'OK' else 'PRUEFEN' end,
         'geko_fotos-Regeln: ' || count(*) filter (where policyname like 'geko_fotos%')
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'

  union all
  -- 7) Lohn-Ordner ist privat ------------------------------------------------
  select 7, 'Dokumente-Speicher privat',
         case when bool_or(id = 'lohn' and public = false) then 'OK' else 'PRUEFEN' end,
         coalesce(string_agg(id || '=' || case when public then 'oeffentlich' else 'privat' end, ', '), 'kein Bucket')
    from storage.buckets where id in ('lohn', 'fotos')

  union all
  -- 8) Geraete-Uebersicht ----------------------------------------------------
  select 8, 'Geraete-Anzeige eingerichtet',
         case when count(*) = 2 then 'OK' else 'PRUEFEN' end,
         count(*) || ' von 2 Spalten (geraet, auth_user_id)'
    from information_schema.columns
   where table_name = 'push_subscriptions' and column_name in ('geraet', 'auth_user_id')

  union all
  -- 9) Zuletzt gesehen --------------------------------------------------------
  select 9, 'Anmeldestand wird erfasst',
         case when count(*) = 1 then 'OK' else 'PRUEFEN' end,
         case when count(*) = 1 then 'zuletzt_gesehen vorhanden' else 'Spalte fehlt' end
    from information_schema.columns
   where table_name = 'glas_mitarbeiter' and column_name = 'zuletzt_gesehen'

  union all
  -- 10) Arbeitszeiten privat --------------------------------------------------
  select 10, 'Arbeitszeiten nur eigene',
         case when bool_or(qual like '%geko_ma_id()%') then 'OK' else 'PRUEFEN' end,
         'Leseregel auf checkin_schichten'
    from pg_policies
   where tablename = 'checkin_schichten' and cmd = 'SELECT' and policyname like 'geko_ma%'

  union all
  -- 11) Zeitplaene ------------------------------------------------------------
  select 11, 'Automatische Erinnerungen',
         case when count(*) filter (where active) = 3 then 'OK' else 'PRUEFEN' end,
         count(*) filter (where active) || ' von 3 aktiv'
    from cron.job
   where jobname in ('daily-termin-reminders', 'checkin-abmelde-erinnerungen', 'geko-lager-erinnerung')

  union all
  -- 12) Tragen die Zeitplaene das Geheimnis? ----------------------------------
  select 12, 'Zeitplaene mit Geheimnis',
         case when count(*) filter (where command like '%x-geko-cron%'
                                      and command not like '%DEIN-CRON-GEHEIMNIS%') = 3
              then 'OK' else 'PRUEFEN' end,
         count(*) filter (where command like '%x-geko-cron%') || ' von 3 mit Kopfzeile'
           || case when bool_or(command like '%DEIN-CRON-GEHEIMNIS%')
                   then ' - ACHTUNG: Platzhalter nicht ersetzt!' else '' end
    from cron.job
   where jobname in ('daily-termin-reminders', 'checkin-abmelde-erinnerungen', 'geko-lager-erinnerung')

  union all
  -- 13) Hilfsfunktionen --------------------------------------------------------
  select 13, 'Pruef-Funktionen vorhanden',
         case when count(*) >= 4 then 'OK' else 'PRUEFEN' end,
         count(*) || ' von 4 - ' || coalesce(string_agg(proname, ', '), 'keine')
    from pg_proc
   where proname in ('geko_ist_admin', 'geko_ma_id', 'geko_darf', 'geko_ist_oberadmin')
)
select nr, pruefpunkt, ergebnis, hinweis from p order by nr;
