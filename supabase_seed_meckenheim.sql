-- Stadt Meckenheim (Glasreinigung): Kunde + 16 Objekte aus
-- Glasreinigung_Meckenheim_Termine_2x_jaehrlich.xlsx (Projektuebersicht).
-- Alle Objekte: Pos. 1 Glas- und Rahmenreinigung, feste Monate Maerz + Oktober (3,10).
-- Objekte Nr. 5-11 (Schulen/Neubauten) starten laut Excel erst ab 2027: dafuer
--   faelligkeit_override = 2027-03-01, damit sie bis dahin auf 'geplant' stehen und
--   nicht schon 2026 als faellig erscheinen. Beim ersten Unterschreiben loescht die App
--   den Override automatisch (faelligkeit_override: null) -> danach normaler 03/10-Rhythmus.
-- Kd.-Nr. war in der Excel nicht angegeben (bleibt leer). Vorlage: geko.
-- Koordinaten werden beim naechsten Oeffnen der Admin-Seite automatisch ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.
-- qm 08/2026 exakt nach Original-Preisblatt 'Los 3.1 GlR' korrigiert (Summe 5757,28 qm).

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-meckenheim', 'Stadt Meckenheim', E'Siebengebirgsring 4\n53340 Meckenheim', '', 'glas'
where not exists (select 1 from kunden where name ilike '%meckenheim%');

-- Nr. 1: Kita Pusteblume
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck1', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Pusteblume', E'Siebengebirgsring 10\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck1')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck1-p1', 'meck1', '1', 'Glas- und Rahmenreinigung', '209,08', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck1')
on conflict (id) do nothing;

-- Nr. 2: Kita Rappelkiste
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck2', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Rappelkiste', E'Marienburgerstraße 144\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck2')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck2-p1', 'meck2', '1', 'Glas- und Rahmenreinigung', '167,00', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck2')
on conflict (id) do nothing;

-- Nr. 3: Kita Steinbüchel
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck3', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Steinbüchel', E'Kastanienstraße 2\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck3')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck3-p1', 'meck3', '1', 'Glas- und Rahmenreinigung', '72,51', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck3')
on conflict (id) do nothing;

-- Nr. 4: Kita Villa Sonnenschein
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck4', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Villa Sonnenschein', E'Gemeindegasse 31\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck4')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck4-p1', 'meck4', '1', 'Glas- und Rahmenreinigung', '24,30', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck4')
on conflict (id) do nothing;

-- Nr. 5: Neubau Gymnasium   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck5', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Neubau Gymnasium', E'Königsbergerstraße 34\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck5')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck5-p1', 'meck5', '1', 'Glas- und Rahmenreinigung', '2475,66', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck5')
on conflict (id) do nothing;

-- Nr. 6: Neubau Hauptschule   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck6', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Neubau Hauptschule', E'Königsbergerstraße 32\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck6')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck6-p1', 'meck6', '1', 'Glas- und Rahmenreinigung', '1339,35', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck6')
on conflict (id) do nothing;

-- Nr. 7: Neubau Mensa / Aula   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck7', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Neubau Mensa / Aula', E'Königsbergerstraße 36\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck7')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck7-p1', 'meck7', '1', 'Glas- und Rahmenreinigung', '335,35', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck7')
on conflict (id) do nothing;

-- Nr. 8: Geschwister-Scholl Hauptschule (Container)   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck8', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Geschwister-Scholl Hauptschule (Container)', E'Königsbergerstr. 30\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck8')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck8-p1', 'meck8', '1', 'Glas- und Rahmenreinigung', '7,35', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck8')
on conflict (id) do nothing;

-- Nr. 9: Neue Container   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck9', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Neue Container', E'Königsbergerstr. 30\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck9')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck9-p1', 'meck9', '1', 'Glas- und Rahmenreinigung', '16,41', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck9')
on conflict (id) do nothing;

-- Nr. 10: Realschule   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck10', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Realschule', E'Königsbergerstr. 30\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck10')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck10-p1', 'meck10', '1', 'Glas- und Rahmenreinigung', '459,04', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck10')
on conflict (id) do nothing;

-- Nr. 11: Pavillon Realschule   [erst ab 2027]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck11', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Pavillon Realschule', E'Königsbergerstr. 30a\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck11')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, faelligkeit_override, reihenfolge)
select 'meck11-p1', 'meck11', '1', 'Glas- und Rahmenreinigung', '54,79', 'feste_monate', '3,10', '2027-03-01', 0
where exists (select 1 from glas_objekte where id = 'meck11')
on conflict (id) do nothing;

-- Nr. 12: Kindercity
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck12', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kindercity', E'Im Ruhrfeld 16\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck12')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck12-p1', 'meck12', '1', 'Glas- und Rahmenreinigung', '1,86', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck12')
on conflict (id) do nothing;

-- Nr. 13: Kita Konfetti
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck13', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Konfetti', E'Im Ruhrfeld 16a\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck13')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck13-p1', 'meck13', '1', 'Glas- und Rahmenreinigung', '99,50', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck13')
on conflict (id) do nothing;

-- Nr. 14: Kita Villa Regenbogen und Mosaik Kulturhaus
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck14', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Villa Regenbogen und Mosaik Kulturhaus', E'Siebengebirgsring 2\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck14')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck14-p1', 'meck14', '1', 'Glas- und Rahmenreinigung', '160,73', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck14')
on conflict (id) do nothing;

-- Nr. 15: Kita Sonnengarten
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck15', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Sonnengarten', E'Baumschulenweg 17\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck15')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck15-p1', 'meck15', '1', 'Glas- und Rahmenreinigung', '225,27', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck15')
on conflict (id) do nothing;

-- Nr. 16: Kita Löwenzahn
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'meck16', (select id from kunden where name ilike '%meckenheim%' limit 1), (select name from kunden where name ilike '%meckenheim%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%meckenheim%' limit 1), 'Kita Löwenzahn', E'Auf dem Drisch 1\n53340 Meckenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'meck16')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'meck16-p1', 'meck16', '1', 'Glas- und Rahmenreinigung', '109,08', 'feste_monate', '3,10', 0
where exists (select 1 from glas_objekte where id = 'meck16')
on conflict (id) do nothing;

