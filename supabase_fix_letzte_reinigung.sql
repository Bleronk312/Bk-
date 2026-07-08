-- ============================================================================
-- EINMALIGE REPARATUR: "zuletzt gereinigt" aus dem Unterschriften-Verlauf nachtragen
-- ============================================================================
-- Hintergrund: Blanko-/Einzelscheine haben bis Runde 17 die Positions-IDs nicht in
-- den Schein-Schnappschuss geschrieben. Beim Unterschreiben wurde deshalb "zuletzt
-- gereinigt" der Objekt-Position NICHT zurückgesetzt - erledigte Objekte (z.B. Kitas)
-- standen weiter als fällig/überfällig und tauchten nirgends als erledigt auf.
--
-- Dieses Skript geht alle unterschriebenen/markierten Scheine durch und setzt je
-- Objekt-Position das jüngste Erledigt-Datum nach. Es überschreibt NIE ein neueres
-- Datum mit einem älteren und ist gefahrlos mehrfach ausführbar.

-- Schritt 1: Treffer über die Positions-ID (normale Touren-Scheine)
with sign as (
  select pos->>'id' as pos_id,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and coalesce(pos->>'id', '') <> ''
  group by 1
)
update glas_objekt_positionen op
set letzte_reinigung = s.am,
    faelligkeit_override = null
from sign s
where s.pos_id = op.id
  and s.am is not null
  and (op.letzte_reinigung is null or op.letzte_reinigung < s.am);

-- Schritt 2: Scheine OHNE Positions-ID (alte Blankos) über Objekt + Leistungsname
with sign as (
  select st.objekt_id,
         lower(trim(pos->>'art')) as art,
         max(coalesce(st.datum, (st.signed_at)::date)) as am
  from glas_stopps st
  cross join lateral jsonb_array_elements(st.positionen::jsonb) as pos
  where st.status = 'erledigt'
    and st.positionen like '[%'
    and coalesce(pos->>'id', '') = ''
    and coalesce(st.objekt_id, '') <> ''
  group by 1, 2
)
update glas_objekt_positionen op
set letzte_reinigung = s.am,
    faelligkeit_override = null
from sign s
where s.objekt_id = op.objekt_id
  and lower(trim(op.art)) = s.art
  and s.am is not null
  and (op.letzte_reinigung is null or op.letzte_reinigung < s.am);

-- Kontrolle (optional): zeigt die 30 zuletzt gereinigten Positionen
select o.name as objekt, op.art, op.letzte_reinigung
from glas_objekt_positionen op
join glas_objekte o on o.id = op.objekt_id
where op.letzte_reinigung is not null
order by op.letzte_reinigung desc
limit 30;
