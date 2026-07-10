-- Kunden einer Firma zuordnen: GEKO Clean ('geko') oder Dietrich ('sub').
-- Idempotent - kann gefahrlos mehrfach ausgeführt werden.
--
-- WICHTIG: Die Kd.-Nr. steht bei Dietrich-Kunden oft NICHT am Kunden, sondern nur an
-- den Objekten. Die Zuordnung schaut deshalb erst auf die Kunden-Kd.-Nr. und fällt
-- dann auf die Objekt-Kd.-Nrn. zurück:
--   1) Kunden-Kd.-Nr. 10xx (1067, 1069, 1070, ...)      -> geko
--   2) Kunden-Kd.-Nr. vorhanden, nicht 10xx              -> sub (Dietrich)
--   3) keine Kunden-Kd.-Nr., ein Objekt mit 10xx         -> geko
--   4) keine Kunden-Kd.-Nr., Objekte mit anderer Kd.-Nr. -> sub (Dietrich)
--   5) nirgends eine Kd.-Nr.                             -> geko (Standard, umstellbar)

alter table kunden add column if not exists firma text default 'geko';

-- VORAB PRÜFEN (nur lesen): zeigt pro Kunde die Kd.-Nrn. und die geplante Zuordnung.
-- select k.name, k.kdnr as kunden_kdnr,
--        (select string_agg(distinct trim(o.kdnr), ', ') from glas_objekte o
--          where o.kunde_id = k.id and coalesce(trim(o.kdnr),'') <> '') as objekt_kdnrs,
--        case
--          when trim(coalesce(k.kdnr,'')) ~ '^10[0-9]{2}$' then 'geko'
--          when coalesce(trim(k.kdnr),'') <> '' then 'sub'
--          when exists (select 1 from glas_objekte o where o.kunde_id = k.id
--                         and trim(coalesce(o.kdnr,'')) ~ '^10[0-9]{2}$') then 'geko'
--          when exists (select 1 from glas_objekte o where o.kunde_id = k.id
--                         and coalesce(trim(o.kdnr),'') <> '') then 'sub'
--          else 'geko'
--        end as wird_firma
-- from kunden k
-- where coalesce(k.bereich,'glas') in ('glas','beide')
-- order by wird_firma, k.name;

update kunden k set firma = case
    when trim(coalesce(k.kdnr,'')) ~ '^10[0-9]{2}$' then 'geko'
    when coalesce(trim(k.kdnr),'') <> '' then 'sub'
    when exists (select 1 from glas_objekte o where o.kunde_id = k.id
                   and trim(coalesce(o.kdnr,'')) ~ '^10[0-9]{2}$') then 'geko'
    when exists (select 1 from glas_objekte o where o.kunde_id = k.id
                   and coalesce(trim(o.kdnr),'') <> '') then 'sub'
    else 'geko'
  end
where coalesce(k.bereich,'glas') in ('glas','beide');

-- Kontrolle danach:
-- select firma, count(*) from kunden where coalesce(bereich,'glas') in ('glas','beide') group by firma;
