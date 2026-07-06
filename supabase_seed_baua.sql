-- BAuA Dortmund (Bundesanstalt für Arbeitsschutz und Arbeitsmedizin):
-- Kunde + 2 Objekte (Los 2.4 = Haus III, Los 2.1-2.3 = Haus I, II, IV) aus Mappe1.xlsx
-- (Stand 26.01.2026). Alle Leistungen als Pos. 10 Glas- und Rahmenreinigung,
-- Flächen je Intervall aufsummiert:
--   Los 2.4 (Haus III):        12x/Jahr 371,76 qm · 6x/Jahr 536,66 qm · Großreinigung 2x/Jahr 7.502,46 qm (alle Positionen)
--   Los 2.1-2.3 (Haus I,II,IV): 12x/Jahr 781,08 qm · Großreinigung 2x/Jahr 5.714,07 qm (alle Positionen; 6x-Intervall kommt in diesem Los nicht vor)
-- Ansprechpartner: Raphael Golz, +49 231 9071 2681. Vorlage: GEKO.
-- Monats-Annahmen (im Objekt jederzeit änderbar): alle 2 Monate = gerade Monate (2,4,6,8,10,12),
-- Großreinigung = April + Oktober (4,10). Monatsreinigung = jeden Monat (1-12).
-- Koordinaten werden beim nächsten Öffnen der Admin-Seite automatisch ergänzt.
-- Sicher mehrfach ausführbar. In Supabase SQL Editor einfügen -> Run.

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-baua-dortmund', 'Bundesanstalt für Arbeitsschutz und Arbeitsmedizin (BAuA) Dortmund', E'Friedrich-Henkel-Weg 1–25\n44149 Dortmund', '', 'glas'
where not exists (select 1 from kunden where name ilike '%arbeitsschutz%');

-- ============ Los 2.4: Haus III ============
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'baua24',
  (select id from kunden where name ilike '%arbeitsschutz%' limit 1),
  (select name from kunden where name ilike '%arbeitsschutz%' limit 1),
  (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%arbeitsschutz%' limit 1),
  'BAuA Haus III (Los 2.4)', E'Friedrich-Henkel-Weg 1–25\n44149 Dortmund', '', 'Raphael Golz', '+49 231 9071 2681', 'geko', null, null
where not exists (select 1 from glas_objekte where name = 'BAuA Haus III (Los 2.4)')
on conflict (id) do nothing;

insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua24-p1', 'baua24', '10', 'Glas- und Rahmenreinigung – Monatsreinigung', '371,76', 'feste_monate', '1,2,3,4,5,6,7,8,9,10,11,12', 0
where exists (select 1 from glas_objekte where id = 'baua24')
on conflict (id) do nothing;

insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua24-p2', 'baua24', '10', 'Glas- und Rahmenreinigung – alle 2 Monate', '536,66', 'feste_monate', '2,4,6,8,10,12', 1
where exists (select 1 from glas_objekte where id = 'baua24')
on conflict (id) do nothing;

insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua24-p3', 'baua24', '10', 'Glas- und Rahmenreinigung – Großreinigung (alle Positionen)', '7502,46', 'feste_monate', '4,10', 2
where exists (select 1 from glas_objekte where id = 'baua24')
on conflict (id) do nothing;

-- ============ Los 2.1-2.3: Haus I, II, IV ============
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'baua213',
  (select id from kunden where name ilike '%arbeitsschutz%' limit 1),
  (select name from kunden where name ilike '%arbeitsschutz%' limit 1),
  (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%arbeitsschutz%' limit 1),
  'BAuA Haus I, II, IV (Los 2.1–2.3)', E'Friedrich-Henkel-Weg 1–25\n44149 Dortmund', '', 'Raphael Golz', '+49 231 9071 2681', 'geko', null, null
where not exists (select 1 from glas_objekte where name = 'BAuA Haus I, II, IV (Los 2.1–2.3)')
on conflict (id) do nothing;

insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua213-p1', 'baua213', '10', 'Glas- und Rahmenreinigung – Monatsreinigung', '781,08', 'feste_monate', '1,2,3,4,5,6,7,8,9,10,11,12', 0
where exists (select 1 from glas_objekte where id = 'baua213')
on conflict (id) do nothing;

insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'baua213-p2', 'baua213', '10', 'Glas- und Rahmenreinigung – Großreinigung (alle Positionen)', '5714,07', 'feste_monate', '4,10', 1
where exists (select 1 from glas_objekte where id = 'baua213')
on conflict (id) do nothing;
