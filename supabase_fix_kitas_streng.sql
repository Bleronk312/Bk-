-- ============================================================================
-- STRENGER NEUAUFBAU: "zuletzt gereinigt" fuer die Zweckverband-Kitas
-- ============================================================================
-- Warum: Die V2-Reparatur konnte falsche Werte nur zuruecknehmen, wenn der
-- Geister-Schein noch in der Datenbank existiert. Stammt der Wert aber z.B. aus
-- einer ENDGUELTIG geloeschten Tour (Stopp ist mit der Tour verschwunden), bleibt
-- der falsche Wert stehen - so wie bei "Christ Koenig / 402" (faelschlich Monat 11).
--
-- Dieses Skript baut "zuletzt gereinigt" fuer ALLE Objekte des Zweckverbands streng
-- neu auf: nur gueltige Scheine zaehlen (Tour existiert, nicht archiviert, echte
-- Unterschrift ODER bewusst als unterschrieben markiert). Gibt es keinen gueltigen
-- Nachweis, wird der Wert GELEERT -> das Objekt ist wieder normal faellig.
-- Das ist fuer diesen Kunden sicher, weil der Kita-Import nie ein "zuletzt
-- gereinigt" gesetzt hat: JEDER Wert dort muss von einem echten Schein stammen.
-- Gefahrlos mehrfach ausfuehrbar. Andere Kunden werden NICHT angefasst.

-- ---------------------------------------------------------------------------
-- Diagnose 1: WOHER kommt der November bei der 402? Es gibt ZWEI moegliche Quellen:
--   a) letzte_reinigung (faelschlich gesetzt -> naechster fester Monat rueckt weiter)
--   b) faelligkeit_override (die "🔁 Verschieben"-Funktion - wurde von den bisherigen
--      Reparatur-Skripten NICHT zurueckgesetzt!)
select o.name as objekt, op.art, op.letzte_reinigung, op.faelligkeit_override, op.feste_monate
from glas_objekt_positionen op
join glas_objekte o on o.id = op.objekt_id
where o.name ilike '%402%';

-- Diagnose 2: ALLES, was zur 402 an Erledigt-Spuren existiert
-- (left join: zeigt auch verwaiste Stopps, deren Tour geloescht wurde)
select st.objekt, t.name as tour, t.datum as tour_datum,
       t.id is null as tour_komplett_geloescht,
       t.archiviert_am is not null as tour_archiviert,
       st.status, st.datum as schein_datum, st.name as unterschrieben_von,
       coalesce(st.unterschrift, '') <> '' as unterschrift_vorhanden,
       st.manuell_erledigt_am
from glas_stopps st
left join glas_touren t on t.id = st.tour_id
where st.objekt ilike '%402%'
   or st.objekt_id in (select id from glas_objekte where name ilike '%402%');

-- ---------------------------------------------------------------------------
-- Der Neuaufbau (Zweckverband-Kitas)
with nachweis as (
  select pos->>'id' as pos_id,
         st.objekt_id,
         lower(trim(pos->>'art')) as art,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  join glas_touren t on t.id = st.tour_id
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and t.archiviert_am is null
    and (coalesce(st.unterschrift, '') <> '' or st.manuell_erledigt_am is not null)
  group by 1, 2, 3
)
update glas_objekt_positionen op
set letzte_reinigung = (
      select max(n.am) from nachweis n
      where n.pos_id = op.id
         or (coalesce(n.pos_id, '') = ''
             and n.objekt_id = op.objekt_id
             and n.art = lower(trim(op.art)))
    ),
    faelligkeit_override = null
from glas_objekte o
where o.id = op.objekt_id
  and o.kunde_id in (select id from kunden where name ilike '%zweckverband%');

-- ---------------------------------------------------------------------------
-- Kontrolle 1: Stand der 402 danach. BEIDE Felder muessen leer sein, wenn es keinen
-- gueltigen Schein gibt -> das Objekt gilt sofort wieder als faellig.
select o.name as objekt, op.art, op.letzte_reinigung, op.faelligkeit_override, op.feste_monate
from glas_objekt_positionen op
join glas_objekte o on o.id = op.objekt_id
where o.name ilike '%402%';

-- Kontrolle 2: Uebersicht Zweckverband - wie viele Kitas haben jetzt einen
-- (gueltigen) Reinigungs-Nachweis, wie viele nicht?
select case when op.letzte_reinigung is null then 'ohne Nachweis (faellig)' else 'mit gueltigem Schein' end as stand,
       count(distinct o.id) as objekte
from glas_objekt_positionen op
join glas_objekte o on o.id = op.objekt_id
where o.kunde_id in (select id from kunden where name ilike '%zweckverband%')
group by 1;
