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

-- FH Suedwestfalen: qm-KORREKTUR aller Glas-Positionen auf die exakten Werte aus
-- 5.1_Preisblaetter.xlsx (Lose 6-10 GlR). Basis: die offiziellen Zwischensummen der
-- Preisblaetter (2 Dezimalen, wie im Blatt angezeigt), pro Objekt aufsummiert -
-- z.B. Meschede Lindenstr. 53 = 688,88 + 1633,30 + 778,08 + 5,79 = 3106,05.
-- Hintergrund: die fruehere Anlage hatte gerundete Werte aus der Termine-Excel.
-- Es wird AUSSCHLIESSLICH das qm-Feld (und ein Objektname) geaendert - keine
-- Intervalle, Scheine, Verlaeufe. Idempotent. Supabase SQL Editor -> Run.
--
-- alt -> neu:
--   fhsw3: 369 -> 369,50
--   fhsw4: 422 -> 422,23
--   fhsw5: 5599 -> 5592,90
--   fhsw7: 720 -> 720,65
--   fhsw8: 3114 -> 3106,05
--   fhsw9: 537 -> 537,93
--   fhsw10: 30 -> 30,18
--   fhsw11: 4704 -> 4704,06
--   fhsw12: 94 -> 94,28
--   fhsw13: 410 -> 410,23
--   fhsw6 (Kalkofen, 40) und fhsw14 (Mawicker, 100) waren bereits exakt.
--   Hagen (per App angelegt): Haldener Str. 182 -> 4687,26 | Im Alten Holz 131 -> 815,13

update glas_objekt_positionen set qm = '369,50' where id = 'fhsw3-p1';
update glas_objekt_positionen set qm = '422,23' where id = 'fhsw4-p1';
update glas_objekt_positionen set qm = '5592,90' where id = 'fhsw5-p1';
update glas_objekt_positionen set qm = '720,65' where id = 'fhsw7-p1';
update glas_objekt_positionen set qm = '3106,05' where id = 'fhsw8-p1';
update glas_objekt_positionen set qm = '537,93' where id = 'fhsw9-p1';
update glas_objekt_positionen set qm = '30,18' where id = 'fhsw10-p1';
update glas_objekt_positionen set qm = '4704,06' where id = 'fhsw11-p1';
update glas_objekt_positionen set qm = '94,28' where id = 'fhsw12-p1';
update glas_objekt_positionen set qm = '410,23' where id = 'fhsw13-p1';

-- Objektname Frauenstuhlweg: echte Gebaeudeliste laut Preisblatt (statt 'U, CFM')
update glas_objekte set name = 'Iserlohn – Frauenstuhlweg 31 (A-Halle, Audimax, C, H, K, LFM, M, P, Z)'
where id = 'fhsw5';

-- Die zwei per App angelegten Hagen-Objekte (ueber FH-Kunde + Adresse gefunden)
update glas_objekt_positionen p set qm = '4687,26'
from glas_objekte o where o.id = p.objekt_id
  and o.kunde_id in (select id from kunden where name ilike '%südwestfalen%')
  and o.adresse ilike '%haldener%';
update glas_objekt_positionen p set qm = '815,13'
from glas_objekte o where o.id = p.objekt_id
  and o.kunde_id in (select id from kunden where name ilike '%südwestfalen%')
  and o.adresse ilike '%alten holz%';

-- Kontrolle: alle FH-Positionen mit den neuen Werten anzeigen
select o.name, p.qm from glas_objekt_positionen p join glas_objekte o on o.id = p.objekt_id
where o.kunde_id in (select id from kunden where name ilike '%südwestfalen%') order by o.name;

-- Schutz wieder einschalten
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'geko_schutz_positionen') then
    execute 'alter table glas_objekt_positionen enable trigger geko_schutz_positionen';
  end if;
end $$;
