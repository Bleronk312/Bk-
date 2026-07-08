-- Stadt Bruehl (Glasreinigung): Kunde + 13 Objekte aus
-- Glasreinigung_Bruehl_Termine_2x_jaehrlich.xlsx (Kombinierte Tabelle).
-- Alle Objekte: Pos. 1 Glas- und Rahmenreinigung, feste Monate Maerz + Oktober (3,10).
-- Excel-Zeilen 10 (Gesamtschule) und 13 (Turnhalle) sind EIN Objekt
--   ('Gesamtschule + Turnhalle Otto Wels') mit ZWEI Positionen (nicht summiert):
--   2212,01 qm (Gesamtschule) + 51,55 qm (Turnhalle).
-- Kd.-Nr. war in der Excel nicht angegeben (bleibt leer). Vorlage: geko.
-- Koordinaten werden beim naechsten Oeffnen der Admin-Seite automatisch ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-bruehl', 'Stadt Brühl', E'Uhlstraße 3\n50321 Brühl', '', 'glas'
where not exists (select 1 from kunden where name ilike '%brühl%');

-- Nr. 1: KGS St. Franziskus-Schule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl1', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'KGS St. Franziskus-Schule', E'An d. Synagoge 1\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl1')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl1-p1', 'bruehl1', '1', 'Glas- und Rahmenreinigung', '480,4', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl1')
on conflict (id) do nothing;

-- Nr. 2: Kunst und Musikschule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl2', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Kunst und Musikschule', E'Liblarer Straße 12\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl2')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl2-p1', 'bruehl2', '1', 'Glas- und Rahmenreinigung', '184,23', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl2')
on conflict (id) do nothing;

-- Nr. 3: GGS Martin-Luther
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl3', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'GGS Martin-Luther', E'Bonnstraße 52\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl3')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl3-p1', 'bruehl3', '1', 'Glas- und Rahmenreinigung', '326,27', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl3')
on conflict (id) do nothing;

-- Nr. 4: Kita an der alten Zuckerfabrik
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl4', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Kita an der alten Zuckerfabrik', E'Sophie-Scholl-Straße 2\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl4')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl4-p1', 'bruehl4', '1', 'Glas- und Rahmenreinigung', '71,37', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl4')
on conflict (id) do nothing;

-- Nr. 5: Astrid-Lindgren-Schule + TH
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl5', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Astrid-Lindgren-Schule + TH', E'Rodderweg 93\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl5')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl5-p1', 'bruehl5', '1', 'Glas- und Rahmenreinigung', '789,88', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl5')
on conflict (id) do nothing;

-- Nr. 6: Barbara Schule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl6', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Barbara Schule', E'Mühlenbach 65\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl6')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl6-p1', 'bruehl6', '1', 'Glas- und Rahmenreinigung', '691,8', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl6')
on conflict (id) do nothing;

-- Nr. 7: Pestalozzi Schule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl7', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Pestalozzi Schule', E'Kölnstraße 85\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl7')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl7-p1', 'bruehl7', '1', 'Glas- und Rahmenreinigung', '424,19', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl7')
on conflict (id) do nothing;

-- Nr. 8: Erich Kästner Realschule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl8', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Erich Kästner Realschule', E'Römerstraße 294\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl8')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl8-p1', 'bruehl8', '1', 'Glas- und Rahmenreinigung', '1333,7', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl8')
on conflict (id) do nothing;

-- Nr. 9: Max-Ernst-Gymnasium + TH
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl9', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Max-Ernst-Gymnasium + TH', E'Rodderweg 66\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl9')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl9-p1', 'bruehl9', '1', 'Glas- und Rahmenreinigung', '2099,81', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl9')
on conflict (id) do nothing;

-- Nr. 10 + 13: Gesamtschule + Turnhalle Otto Wels (2 Positionen: Gesamtschule + Turnhalle)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl10', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Gesamtschule + Turnhalle Otto Wels', E'Otto-Wels-Straße 1\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl10')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl10-p1', 'bruehl10', '1', 'Glas- und Rahmenreinigung', '2212,01', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl10')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl10-p2', 'bruehl10', '1', 'Glas- und Rahmenreinigung', '51,55', 'feste_monate', '3,10', 1
where exists (select 1 from glas_objekte where id = 'bruehl10')
on conflict (id) do nothing;

-- Nr. 11: Kita Mühlenbach
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl11', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Kita Mühlenbach', E'Mühlenbach 65\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl11')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl11-p1', 'bruehl11', '1', 'Glas- und Rahmenreinigung', '178,02', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl11')
on conflict (id) do nothing;

-- Nr. 12: Kita An der Eckdorfer Mühle
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl12', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'Kita An der Eckdorfer Mühle', E'Eckdorfer Straße 37\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl12')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl12-p1', 'bruehl12', '1', 'Glas- und Rahmenreinigung', '118,94', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl12')
on conflict (id) do nothing;

-- Nr. 14: HS Clemens-August
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'bruehl14', (select id from kunden where name ilike '%brühl%' limit 1), (select name from kunden where name ilike '%brühl%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%brühl%' limit 1), 'HS Clemens-August', E'Clemens-August-Straße 33\n50321 Brühl', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'bruehl14')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'bruehl14-p1', 'bruehl14', '1', 'Glas- und Rahmenreinigung', '516,39', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'bruehl14')
on conflict (id) do nothing;

