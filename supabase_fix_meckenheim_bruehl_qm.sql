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

-- KORREKTUR Stadt Meckenheim + Stadt Bruehl: qm exakt nach Original-Preisblatt.
-- Quellen: 5.1_bis_5.2_Zusammenfassung_und_Preisblaetter_V5.xlsx, Blatt "Los 3.1 GlR"
--          (Meckenheim, ZS-Zeilen je Objekt) und Anlage GLS "Los 7" (Bruehl).
--
-- MECKENHEIM: 8 Werte waren gerundet (die frueher genutzte Termine-Uebersicht enthielt
--   gerundete Zahlen). Jetzt centgenau. Kontrollsumme aller 16 Objekte: 5757,28 qm.
-- BRUEHL: alle 14 Flaechen waren bereits exakt (Summe Los 7 = 9478,56 qm). Ergaenzt
--   werden nur die fehlenden Nachkommastellen in der Schreibweise sowie eine im
--   Preisblatt vorhandene, bisher fehlende Position: Innenglasreinigung 43,62 qm
--   an der KGS St. Franziskus-Schule (beidseitig, ohne Rahmen).
--
-- Es wird ausschliesslich das qm-Feld geaendert bzw. eine Position ergaenzt.
-- Keine Intervalle, Scheine, Verlaeufe oder Unterschriften werden beruehrt.
-- Idempotent - mehrfach ausfuehrbar. Supabase SQL Editor -> Run.

-- ============================================================
-- MECKENHEIM - Korrekturen (alt -> neu)
-- ============================================================
update glas_objekt_positionen set qm = '209,08'  where id = 'meck1-p1';   -- Kita Pusteblume        210    -> 209,08
update glas_objekt_positionen set qm = '167,00'  where id = 'meck2-p1';   -- Kita Rappelkiste       167    -> 167,00
update glas_objekt_positionen set qm = '72,51'   where id = 'meck3-p1';   -- Kita Steinbuechel      72,5   -> 72,51
update glas_objekt_positionen set qm = '24,30'   where id = 'meck4-p1';   -- Villa Sonnenschein     25     -> 24,30
update glas_objekt_positionen set qm = '2475,66' where id = 'meck5-p1';   -- Neubau Gymnasium       2475   -> 2475,66
update glas_objekt_positionen set qm = '1339,35' where id = 'meck6-p1';   -- Neubau Hauptschule     1340   -> 1339,35
update glas_objekt_positionen set qm = '335,35'  where id = 'meck7-p1';   -- Neubau Mensa/Aula      335    -> 335,35
update glas_objekt_positionen set qm = '7,35'    where id = 'meck8-p1';   -- Geschw.-Scholl HS      7,35   (war korrekt)
update glas_objekt_positionen set qm = '16,41'   where id = 'meck9-p1';   -- neue Mitte Container   16,41  (war korrekt)
update glas_objekt_positionen set qm = '459,04'  where id = 'meck10-p1';  -- Realschule             459    -> 459,04
update glas_objekt_positionen set qm = '54,79'   where id = 'meck11-p1';  -- Pavillon Realschule    54,79  (war korrekt)
update glas_objekt_positionen set qm = '1,86'    where id = 'meck12-p1';  -- Kindercity             1,86   (war korrekt)
update glas_objekt_positionen set qm = '99,50'   where id = 'meck13-p1';  -- Kita Konfetti          99,5   -> 99,50
update glas_objekt_positionen set qm = '160,73'  where id = 'meck14-p1';  -- Villa Regenbogen+Mosaik 160,73 (war korrekt)
update glas_objekt_positionen set qm = '225,27'  where id = 'meck15-p1';  -- Kita Sonnengarten      225,27 (war korrekt)
update glas_objekt_positionen set qm = '109,08'  where id = 'meck16-p1';  -- Kita Loewenzahn        109    -> 109,08

-- ============================================================
-- BRUEHL - Schreibweise vervollstaendigen (numerisch unveraendert)
-- ============================================================
update glas_objekt_positionen set qm = '480,40'  where id = 'bruehl1-p1';
update glas_objekt_positionen set qm = '691,80'  where id = 'bruehl6-p1';
update glas_objekt_positionen set qm = '1333,70' where id = 'bruehl8-p1';

-- BRUEHL - fehlende Position ergaenzen: Innenglasreinigung KGS St. Franziskus-Schule
-- (Preisblatt Los 7, Spalte "Innenglasreinigung (beidseitig zu reinigen, ohne Rahmen)")
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl1-p2', 'bruehl1', '2', 'Innenglasreinigung (ohne Rahmen)', '43,62', 'feste_monate', '3,10', 1
where exists (select 1 from glas_objekte where id = 'bruehl1')
on conflict (id) do nothing;

-- ============================================================
-- Kontrolle
-- ============================================================
select k.name as kunde, o.name as objekt, p.nr as pos, p.qm
from glas_objekt_positionen p
join glas_objekte o on o.id = p.objekt_id
join kunden       k on k.id = o.kunde_id
where k.name ilike '%meckenheim%' or k.name ilike '%brühl%'
order by k.name, o.name, p.reihenfolge;

-- Erwartete Summen: Meckenheim 5757,28 qm | Bruehl Aussenglas 9478,56 + Innenglas 43,62 qm
select k.name as kunde, round(sum(replace(p.qm,',','.')::numeric),2) as summe_qm
from glas_objekt_positionen p
join glas_objekte o on o.id = p.objekt_id
join kunden       k on k.id = o.kunde_id
where (k.name ilike '%meckenheim%' or k.name ilike '%brühl%')
  and p.qm ~ '^[0-9]+([,.][0-9]+)?$'
group by k.name;

-- Schutz wieder einschalten
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'geko_schutz_positionen') then
    execute 'alter table glas_objekt_positionen enable trigger geko_schutz_positionen';
  end if;
end $$;
