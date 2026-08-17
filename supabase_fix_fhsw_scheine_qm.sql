-- FH Suedwestfalen: qm-Korrektur auch auf bereits UNTERSCHRIEBENEN Abnahmescheinen.
-- Jeder Schein (glas_stopps) traegt eine eigene Kopie der Positionen (JSON).
-- Diese Datei ersetzt darin AUSSCHLIESSLICH die qm-Werte durch die exakten
-- Preisblatt-Werte - Unterschrift, Datum, Name, Leistungstext bleiben unangetastet.
--
-- SICHERHEITSNETZ: Vor jeder Aenderung wird der Original-Zustand jedes betroffenen
-- Scheins in die Tabelle glas_stopps_qm_backup_fhsw gesichert (bleibt dauerhaft
-- erhalten, auch bei mehrfachem Ausfuehren wird nur der ERSTE Zustand gesichert).
-- Wiederherstellen (falls je noetig):
--   update glas_stopps s set positionen = b.positionen
--   from glas_stopps_qm_backup_fhsw b where b.id = s.id;
--
-- Idempotent - mehrfach ausfuehrbar. Supabase SQL Editor -> Run.

-- 1) Backup aller Scheine des FH-Kunden (nur erster Zustand wird festgehalten)
create table if not exists glas_stopps_qm_backup_fhsw (
  id text primary key,
  positionen text,
  gesichert_am timestamptz default now()
);
insert into glas_stopps_qm_backup_fhsw (id, positionen)
select s.id, s.positionen
from glas_stopps s
join glas_objekte o on o.id = s.objekt_id
where o.kunde_id in (select id from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;

-- 2) qm in den Schein-Kopien ersetzen - Positionen der per SQL angelegten Objekte
--    (fhsw3-14, eindeutige Positions-IDs). Reihenfolge im JSON bleibt erhalten.
with mapping(pid, neu) as (values
  ('fhsw3-p1','369,50'), ('fhsw4-p1','422,23'), ('fhsw5-p1','5592,90'),
  ('fhsw7-p1','720,65'), ('fhsw8-p1','3106,05'), ('fhsw9-p1','537,93'),
  ('fhsw10-p1','30,18'), ('fhsw11-p1','4704,06'), ('fhsw12-p1','94,28'),
  ('fhsw13-p1','410,23')
)
update glas_stopps s
set positionen = (
  select jsonb_agg(
           case when m.neu is not null then jsonb_set(elem, '{qm}', to_jsonb(m.neu)) else elem end
           order by ord
         )::text
  from jsonb_array_elements(s.positionen::jsonb) with ordinality as t(elem, ord)
  left join mapping m on m.pid = elem->>'id'
)
where left(coalesce(s.positionen,''), 1) = '['
  and exists (
    select 1 from jsonb_array_elements(s.positionen::jsonb) e
    join mapping m on m.pid = e->>'id'
  );

-- 3) Die zwei per App angelegten Hagen-Objekte (Positions-IDs unbekannt ->
--    Zuordnung ueber das Objekt; qm wird an der Glas- und Rahmenreinigungs-
--    Position des Scheins ersetzt)
update glas_stopps s
set positionen = (
  select jsonb_agg(
           case when elem->>'art' ilike '%rahmenreinigung%'
                then jsonb_set(elem, '{qm}', to_jsonb('4687,26'::text)) else elem end
           order by ord
         )::text
  from jsonb_array_elements(s.positionen::jsonb) with ordinality as t(elem, ord)
)
from glas_objekte o
where o.id = s.objekt_id
  and o.kunde_id in (select id from kunden where name ilike '%südwestfalen%')
  and o.adresse ilike '%haldener%'
  and left(coalesce(s.positionen,''), 1) = '[';

update glas_stopps s
set positionen = (
  select jsonb_agg(
           case when elem->>'art' ilike '%rahmenreinigung%'
                then jsonb_set(elem, '{qm}', to_jsonb('815,13'::text)) else elem end
           order by ord
         )::text
  from jsonb_array_elements(s.positionen::jsonb) with ordinality as t(elem, ord)
)
from glas_objekte o
where o.id = s.objekt_id
  and o.kunde_id in (select id from kunden where name ilike '%südwestfalen%')
  and o.adresse ilike '%alten holz%'
  and left(coalesce(s.positionen,''), 1) = '[';

-- 4) Kontrolle: geaenderte Scheine mit neuen qm anzeigen (Backup-Zeilen = gesichert)
select s.id, o.name as objekt, s.datum, s.positionen
from glas_stopps s
join glas_objekte o on o.id = s.objekt_id
where o.kunde_id in (select id from kunden where name ilike '%südwestfalen%')
order by s.datum;
