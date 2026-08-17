-- KONTROLLE: alle Kunden, Objekte und Positionen mit qm auf einen Blick.
-- Reine LESE-Abfragen - aendern nichts. Zum Gegenlesen gegen die Original-Preisblaetter.

-- 1) Vollstaendige Liste: Kunde -> Objekt -> Position -> qm
select k.name                     as kunde,
       coalesce(k.kdnr,'')        as kd_nr,
       o.name                     as objekt,
       p.nr                       as pos,
       p.art                      as leistung,
       p.qm                       as qm,
       coalesce(p.feste_monate,'') as monate
from glas_objekt_positionen p
join glas_objekte o on o.id = p.objekt_id
join kunden       k on k.id = o.kunde_id
order by k.name, o.name, p.reihenfolge;

-- 2) VERDACHTSLISTE: qm ohne Nachkommastellen (moeglicherweise gerundet).
--    Achtung: viele Preisblaetter enthalten echte ganze Zahlen - das hier ist nur
--    eine Vorschlagsliste zum Gegenlesen, kein Fehlerbeweis.
select k.name as kunde, o.name as objekt, p.nr as pos, p.qm
from glas_objekt_positionen p
join glas_objekte o on o.id = p.objekt_id
join kunden       k on k.id = o.kunde_id
where coalesce(p.qm,'') <> ''
  and p.qm not like '%,%'
  and p.qm ~ '^[0-9]+$'
order by k.name, o.name;

-- 3) Summe je Kunde (zum Vergleich mit der Gesamtsumme des Preisblatts)
select k.name as kunde,
       count(*) filter (where coalesce(p.qm,'') <> '') as positionen_mit_qm,
       round(sum(replace(p.qm, ',', '.')::numeric), 2) as summe_qm
from glas_objekt_positionen p
join glas_objekte o on o.id = p.objekt_id
join kunden       k on k.id = o.kunde_id
where coalesce(p.qm,'') <> ''
  and p.qm ~ '^[0-9]+([,.][0-9]+)?$'
group by k.name
order by k.name;
