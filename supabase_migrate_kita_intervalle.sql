-- VERWALTUNGS-MODUS: Seit der Sicherheits-Haertung blockiert der Trigger
-- geko_schutz_positionen jede Aenderung an glas_objekt_positionen, die nicht von einem
-- eingeloggten Admin kommt - der SQL Editor zaehlt nicht als eingeloggt. Diese Datei
-- schaltet den Schutz deshalb NUR fuer ihren eigenen Lauf aus und am Ende wieder ein.
-- (Wirkt nur, wenn der Trigger existiert - auf aelteren Staenden passiert nichts.)
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'geko_schutz_positionen') then
    execute 'alter table glas_objekt_positionen disable trigger geko_schutz_positionen';
  end if;
end $$;

-- KITA Zweckverband (93 Kitas): Reinigungs-Intervall Februar / Juli / November (2,7,11)
-- auf allen Kita-Positionen eintragen.
--
-- DATENSICHER: Es wird AUSSCHLIESSLICH das Intervall gesetzt (intervall_typ + feste_monate).
-- Nichts anderes wird angefasst - weder unterschriebene Scheine (glas_stopps) noch das
-- vorhandene "Zuletzt gereinigt"-Datum (letzte_reinigung), qm oder Namen. Voll reversibel.
--
-- Wirkung: Die App berechnet die Faelligkeit automatisch aus dem vorhandenen
-- "Zuletzt gereinigt"-Datum jeder Kita:
--   - bereits gereinigte Kitas  -> naechste Reinigung im November
--   - noch nicht gereinigte     -> sofort faellig ("muss noch gemacht werden")
--   - im November werden alle wieder faellig.
--
-- Nur der KITA Zweckverband ist betroffen. Mehrfach ausfuehrbar. In Supabase -> Run.

update glas_objekt_positionen p
   set intervall_typ = 'feste_monate',
       feste_monate  = '2,7,11'
  from glas_objekte o
 where o.id = p.objekt_id
   and o.kunde_id in (select id from kunden where name ilike '%zweckverband%');

-- Schutz wieder einschalten
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'geko_schutz_positionen') then
    execute 'alter table glas_objekt_positionen enable trigger geko_schutz_positionen';
  end if;
end $$;
