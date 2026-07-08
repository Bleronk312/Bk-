-- BAuA Dortmund (Bundesanstalt für Arbeitsschutz und Arbeitsmedizin):
-- Kunde + EIN Objekt "BAuA Haus I-IV" (Haus I, II, III, IV zusammengefasst) aus Mappe1.xlsx.
-- Alle Leistungen als Pos. 1 Glas- und Rahmenreinigung, Flächen je Intervall über die
-- frueheren Lose 2.1-2.3 (Haus I, II, IV) und 2.4 (Haus III) aufsummiert:
--   Monatsreinigung  1.152,84 qm  (371,76 + 781,08)     jeden Monat
--   alle 2 Monate      536,66 qm  (nur Haus III)          2,4,6,8,10,12
--   Großreinigung   13.216,53 qm  (7.502,46 + 5.714,07)   Apr + Okt (alle Positionen)
-- Ansprechpartner: Raphael Golz, +49 231 9071 2681. Vorlage: GEKO.
-- Monats-Annahmen: alle 2 Monate = gerade Monate; Großreinigung = April + Oktober;
-- Monatsreinigung = jeden Monat. Koordinaten ergänzt die Admin-Seite automatisch.
--
-- HINWEIS: Fuer eine bereits LIVE laufende BAuA (frueher zwei getrennte Objekte) NICHT
-- diese Datei verwenden, sondern supabase_migrate_baua_merge.sql - die fuehrt verlauf-
-- erhaltend zusammen. Diese Seed-Datei ist fuer Neu-Installationen.
-- Sicher mehrfach ausführbar (Namens-Schutz + on conflict do nothing). SQL Editor -> Run.

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-baua-dortmund', 'Bundesanstalt für Arbeitsschutz und Arbeitsmedizin (BAuA) Dortmund', E'Friedrich-Henkel-Weg 1–25\n44149 Dortmund', '', 'glas'
where not exists (select 1 from kunden where name ilike '%arbeitsschutz%');

-- Objekt "BAuA Haus I-IV"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'baua-i-iv',
  (select id from kunden where name ilike '%arbeitsschutz%' limit 1),
  (select name from kunden where name ilike '%arbeitsschutz%' limit 1),
  (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%arbeitsschutz%' limit 1),
  'BAuA Haus I-IV', E'Friedrich-Henkel-Weg 1–25\n44149 Dortmund', '', 'Raphael Golz', '+49 231 9071 2681', 'geko', null, null
where not exists (select 1 from glas_objekte where name = 'BAuA Haus I-IV')
  and exists (select 1 from kunden where name ilike '%arbeitsschutz%')
on conflict (id) do nothing;

-- Pos. 1: Monatsreinigung (jeden Monat), Summe beider Lose
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua-i-iv-p1', 'baua-i-iv', '1', 'Glas- und Rahmenreinigung – Monatsreinigung', '1152,84', 'feste_monate', '1,2,3,4,5,6,7,8,9,10,11,12', 0
where exists (select 1 from glas_objekte where id = 'baua-i-iv')
on conflict (id) do nothing;

-- Pos. 1: alle 2 Monate (nur aus Haus III)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua-i-iv-p2', 'baua-i-iv', '1', 'Glas- und Rahmenreinigung – alle 2 Monate', '536,66', 'feste_monate', '2,4,6,8,10,12', 1
where exists (select 1 from glas_objekte where id = 'baua-i-iv')
on conflict (id) do nothing;

-- Pos. 1: Großreinigung (alle Positionen), Summe beider Lose
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua-i-iv-p3', 'baua-i-iv', '1', 'Glas- und Rahmenreinigung – Großreinigung (alle Positionen)', '13216,53', 'feste_monate', '4,10', 2
where exists (select 1 from glas_objekte where id = 'baua-i-iv')
on conflict (id) do nothing;
