-- ============================================================================
-- Dietrich-Nummern aufräumen: Altbestand hatte die KOMPLETTE Nummer
-- ("1586 502" = Haupt-Kd.-Nr. + Objekt-Nr.) im Objekt-Feld, die Haupt-Kd.-Nr.
-- am Kunden war leer. Diese Migration trennt sauber:
--   kunden.kdnr        := erste Zahl   (Haupt-Kd.-Nr., z.B. 1586)
--   glas_objekte.kdnr  := Rest         (Objekt-Nr.,    z.B. 502)
--
-- Aufs PDF kommt weiterhin die Kombination "1586 502" an derselben Stelle
-- (Kd.-Nr.-Feld) - das Schriftbild ändert sich NICHT.
--
-- Sicherheitsnetze:
--  - nur Dietrich-Kunden (firma = 'sub')
--  - Haupt-Nr. wird nur gesetzt, wenn sie am Kunden noch LEER ist und ALLE
--    Objekte des Kunden dieselbe erste Zahl tragen (sonst: Kunde bleibt
--    unangetastet -> manuell prüfen)
--  - Objekt-Feld wird nur gekürzt, wenn die erste Zahl exakt der Haupt-Nr.
--    des Kunden entspricht
--
-- Einmalig im Supabase SQL Editor ausführen.
-- ============================================================================

begin;

-- 1) Haupt-Kd.-Nr. an den Kunden ziehen
update kunden k
set kdnr = q.haupt
from (
  select o.kunde_id, min(split_part(o.kdnr, ' ', 1)) as haupt
  from glas_objekte o
  where o.kdnr like '% %'
  group by o.kunde_id
  having count(distinct split_part(o.kdnr, ' ', 1)) = 1
) q
where k.id = q.kunde_id
  and k.firma = 'sub'
  and coalesce(trim(k.kdnr), '') = '';

-- 2) Objekt-Feld auf die reine Objekt-Nr. kürzen
update glas_objekte o
set kdnr = ltrim(substring(o.kdnr from position(' ' in o.kdnr) + 1))
from kunden k
where k.id = o.kunde_id
  and k.firma = 'sub'
  and coalesce(trim(k.kdnr), '') <> ''
  and o.kdnr like '% %'
  and split_part(o.kdnr, ' ', 1) = k.kdnr;

commit;

-- Kontrolle: so sollte es danach aussehen (haupt_kdnr gefüllt, objekt_nr kurz).
-- Kunden, bei denen haupt_kdnr noch leer ist, hatten uneinheitliche Nummern
-- und wurden bewusst übersprungen -> bitte manuell prüfen.
select k.name as kunde, k.kdnr as haupt_kdnr, o.name as objekt, o.kdnr as objekt_nr
from kunden k
left join glas_objekte o on o.kunde_id = k.id
where k.firma = 'sub'
order by k.name, o.name;
