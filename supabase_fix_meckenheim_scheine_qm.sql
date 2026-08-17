-- Stadt Meckenheim: qm-Korrektur auch auf bereits UNTERSCHRIEBENEN Abnahmescheinen.
-- Jeder Schein (glas_stopps) traegt eine eigene Kopie der Positionen (JSON).
-- Diese Datei ersetzt darin AUSSCHLIESSLICH die qm-Werte durch die exakten Werte aus
-- dem Original-Preisblatt (Blatt "Los 3.1 GlR"). Unterschrift, Datum, Name und
-- Leistungstext bleiben unangetastet.
--
-- SICHERHEITSNETZ: Vor jeder Aenderung wird der Original-Zustand jedes betroffenen
-- Scheins in glas_stopps_qm_backup_meck gesichert (bei mehrfachem Ausfuehren wird nur
-- der ERSTE Zustand festgehalten).
-- Wiederherstellen (falls je noetig):
--   update glas_stopps s set positionen = b.positionen
--   from glas_stopps_qm_backup_meck b where b.id = s.id;
--
-- Idempotent - mehrfach ausfuehrbar. Supabase SQL Editor -> Run.

-- 1) Backup aller Meckenheim-Scheine (nur erster Zustand)
create table if not exists glas_stopps_qm_backup_meck (
  id text primary key,
  positionen text,
  gesichert_am timestamptz default now()
);
insert into glas_stopps_qm_backup_meck (id, positionen)
select s.id, s.positionen
from glas_stopps s
join glas_objekte o on o.id = s.objekt_id
where o.kunde_id in (select id from kunden where name ilike '%meckenheim%')
on conflict (id) do nothing;

-- 2) qm in den Schein-Kopien ersetzen (Zuordnung ueber die Positions-ID)
with mapping(pid, neu) as (values
  ('meck1-p1','209,08'), ('meck2-p1','167,00'), ('meck3-p1','72,51'),
  ('meck4-p1','24,30'),  ('meck5-p1','2475,66'),('meck6-p1','1339,35'),
  ('meck7-p1','335,35'), ('meck10-p1','459,04'),('meck13-p1','99,50'),
  ('meck16-p1','109,08')
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

-- 3) Kontrolle: Meckenheim-Scheine mit den neuen qm anzeigen
select s.id, o.name as objekt, s.datum, s.positionen
from glas_stopps s
join glas_objekte o on o.id = s.objekt_id
where o.kunde_id in (select id from kunden where name ilike '%meckenheim%')
order by s.datum;
