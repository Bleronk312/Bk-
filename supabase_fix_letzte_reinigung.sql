-- ============================================================================
-- REPARATUR V2: "zuletzt gereinigt" sauber aus dem Unterschriften-Verlauf ableiten
-- ============================================================================
-- V1 dieses Skripts hat zu viel geglaubt: auch Scheine aus ARCHIVIERTEN (geloeschten)
-- Touren und "erledigt"-Stopps OHNE echte Unterschrift wurden gezaehlt. Folge: Objekte
-- wie "Christ Koenig / 402" galten ploetzlich als gereinigt, obwohl in der App nie
-- eine Unterschrift zu sehen war.
--
-- V2 raeumt das auf und ist gefahrlos mehrfach ausfuehrbar:
--   Schritt 1+2: falsche Werte zuruecknehmen (nur wo der Wert exakt von einem
--                UNGUELTIGEN Schein stammt - manuell gepflegte Daten bleiben stehen)
--   Schritt 3+4: gueltige Nachweise neu eintragen (nie ein neueres Datum ueberschreiben)
--
-- GUELTIG = Stopp erledigt UND Tour nicht archiviert UND (Unterschrift vorhanden
--           ODER bewusst "als unterschrieben markiert").
-- Voraussetzung: supabase_add_glas.sql ist ausgefuehrt (Spalte manuell_erledigt_am).

-- ---------------------------------------------------------------------------
-- Schritt 1: Falsche Werte zuruecknehmen (Treffer ueber Positions-ID)
with ungueltig as (
  select pos->>'id' as pos_id,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  join glas_touren t on t.id = st.tour_id
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and coalesce(pos->>'id', '') <> ''
    and (t.archiviert_am is not null
         or (coalesce(st.unterschrift, '') = '' and st.manuell_erledigt_am is null))
  group by 1
)
update glas_objekt_positionen op
set letzte_reinigung = null
from ungueltig u
where u.pos_id = op.id
  and op.letzte_reinigung = u.am;

-- Schritt 2: Falsche Werte zuruecknehmen (Treffer ueber Objekt + Leistungsname)
with ungueltig as (
  select st.objekt_id,
         lower(trim(pos->>'art')) as art,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  join glas_touren t on t.id = st.tour_id
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and coalesce(pos->>'id', '') = ''
    and coalesce(st.objekt_id, '') <> ''
    and (t.archiviert_am is not null
         or (coalesce(st.unterschrift, '') = '' and st.manuell_erledigt_am is null))
  group by 1, 2
)
update glas_objekt_positionen op
set letzte_reinigung = null
from ungueltig u
where u.objekt_id = op.objekt_id
  and lower(trim(op.art)) = u.art
  and op.letzte_reinigung = u.am;

-- ---------------------------------------------------------------------------
-- Schritt 3: Gueltige Nachweise eintragen (Treffer ueber Positions-ID)
with gueltig as (
  select pos->>'id' as pos_id,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  join glas_touren t on t.id = st.tour_id
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and coalesce(pos->>'id', '') <> ''
    and t.archiviert_am is null
    and (coalesce(st.unterschrift, '') <> '' or st.manuell_erledigt_am is not null)
  group by 1
)
update glas_objekt_positionen op
set letzte_reinigung = g.am,
    faelligkeit_override = null
from gueltig g
where g.pos_id = op.id
  and g.am is not null
  and (op.letzte_reinigung is null or op.letzte_reinigung < g.am);

-- Schritt 4: Gueltige Nachweise eintragen (aeltere Scheine ohne Positions-ID)
with gueltig as (
  select st.objekt_id,
         lower(trim(pos->>'art')) as art,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  join glas_touren t on t.id = st.tour_id
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and coalesce(pos->>'id', '') = ''
    and coalesce(st.objekt_id, '') <> ''
    and t.archiviert_am is null
    and (coalesce(st.unterschrift, '') <> '' or st.manuell_erledigt_am is not null)
  group by 1, 2
)
update glas_objekt_positionen op
set letzte_reinigung = g.am,
    faelligkeit_override = null
from gueltig g
where g.objekt_id = op.objekt_id
  and lower(trim(op.art)) = g.art
  and g.am is not null
  and (op.letzte_reinigung is null or op.letzte_reinigung < g.am);

-- ---------------------------------------------------------------------------
-- Kontrolle A: Woher kaeme ein Erledigt-Nachweis fuer die KITA 402?
-- (zeigt ALLE erledigten Stopps zu diesem Objekt - inkl. archivierter Touren
--  und Stopps ohne Unterschrift, damit man den "Geister-Schein" sieht)
select o.name as objekt, t.name as tour, t.datum as tour_datum,
       t.archiviert_am is not null as tour_geloescht,
       st.datum as schein_datum, st.name as unterschrieben_von,
       coalesce(st.unterschrift, '') <> '' as unterschrift_vorhanden,
       st.manuell_erledigt_am
from glas_stopps st
join glas_touren t on t.id = st.tour_id
left join glas_objekte o on o.id = st.objekt_id
where st.status = 'erledigt'
  and (o.name ilike '%402%' or st.objekt ilike '%402%');

-- Kontrolle B: aktueller Stand der 402-Positionen (sollte nach dem Skript wieder
-- letzte_reinigung = NULL zeigen, falls es nie einen gueltigen Schein gab)
select o.name as objekt, op.art, op.letzte_reinigung, op.feste_monate
from glas_objekt_positionen op
join glas_objekte o on o.id = op.objekt_id
where o.name ilike '%402%';
