-- Kunden einer Firma zuordnen: GEKO Clean ('geko') oder Dietrich ('sub').
-- Idempotent - kann gefahrlos mehrfach ausgeführt werden.

alter table kunden add column if not exists firma text default 'geko';

-- OPTIONAL VORAB PRÜFEN (nur lesen, ändert nichts): zeigt, wie die Trennung ausfallen wird.
-- select name, kdnr,
--        case when coalesce(trim(kdnr),'') = '' or trim(kdnr) ~ '^10[0-9]{2}$' then 'geko' else 'sub' end as wird_firma
-- from kunden
-- where coalesce(bereich,'glas') in ('glas','beide')
-- order by wird_firma, name;

-- Bestandskunden trennen: Kd.-Nr. im Muster 10xx (1067, 1069, 1070, ...) = GEKO,
-- alle anderen MIT Kd.-Nr. = Dietrich. Kunden ohne Kd.-Nr. bleiben GEKO (Standard)
-- und können im Kunden-Formular umgestellt werden. Graffiti-Kunden bleiben unberührt.
update kunden set firma = 'sub'
 where coalesce(bereich,'glas') in ('glas','beide')
   and coalesce(trim(kdnr),'') <> ''
   and trim(kdnr) !~ '^10[0-9]{2}$';

update kunden set firma = 'geko'
 where coalesce(firma,'') not in ('geko','sub');

-- Kontrolle danach:
-- select firma, count(*) from kunden where coalesce(bereich,'glas') in ('glas','beide') group by firma;
