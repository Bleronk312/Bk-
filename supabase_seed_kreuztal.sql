-- Stadt Kreuztal (Glasreinigung): Kunde + 6 Objekte (Schulen/Sporthallen)
-- aus den Preisblaettern (Stand 13./14.04.26). Je Objekt eine Position (Pos. 1,
-- Glas- und Rahmenreinigung) mit der Gesamtflaeche des Objekts (alle Teilflaechen
-- summiert). Intervall: 2x jaehrlich, feste Monate Maerz + August (3,8) - laut Vorgabe
-- Schuloster- und Schulsommerferien.
-- Kd.-Nr. war nicht angegeben (bleibt leer). Vorlage: geko.
-- Koordinaten werden beim naechsten Oeffnen der Admin-Seite automatisch ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-kreuztal', 'Stadt Kreuztal', E'Rathaus, Siegener Str. 5\n57223 Kreuztal', '', 'glas'
where not exists (select 1 from kunden where name ilike '%kreuztal%');

-- Dreifach Sporthalle "Stählerwiese"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kreuztal1', (select id from kunden where name ilike '%kreuztal%' limit 1), (select name from kunden where name ilike '%kreuztal%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%kreuztal%' limit 1), 'Dreifach Sporthalle "Stählerwiese"', E'Hessengarten 15\n57223 Kreuztal', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'kreuztal1')
  and exists (select 1 from kunden where name ilike '%kreuztal%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'kreuztal1-p1', 'kreuztal1', '1', 'Glas- und Rahmenreinigung', '603,56', 'feste_monate', '3,8', 0
where exists (select 1 from glas_objekte where id = 'kreuztal1') on conflict (id) do nothing;

-- Zweifach Sporthalle "Stählerwiese"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kreuztal2', (select id from kunden where name ilike '%kreuztal%' limit 1), (select name from kunden where name ilike '%kreuztal%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%kreuztal%' limit 1), 'Zweifach Sporthalle "Stählerwiese"', E'Djurslandweg 1\n57223 Kreuztal', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'kreuztal2')
  and exists (select 1 from kunden where name ilike '%kreuztal%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'kreuztal2-p1', 'kreuztal2', '1', 'Glas- und Rahmenreinigung', '295,39', 'feste_monate', '3,8', 0
where exists (select 1 from glas_objekte where id = 'kreuztal2') on conflict (id) do nothing;

-- Städtisches Gymnasium Kreuztal
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kreuztal3', (select id from kunden where name ilike '%kreuztal%' limit 1), (select name from kunden where name ilike '%kreuztal%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%kreuztal%' limit 1), 'Städtisches Gymnasium Kreuztal', E'Zum Erbstollen 5\n57223 Kreuztal', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'kreuztal3')
  and exists (select 1 from kunden where name ilike '%kreuztal%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'kreuztal3-p1', 'kreuztal3', '1', 'Glas- und Rahmenreinigung', '1685,07', 'feste_monate', '3,8', 0
where exists (select 1 from glas_objekte where id = 'kreuztal3') on conflict (id) do nothing;

-- Ernst-Moritz-Arndt-Realschule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kreuztal4', (select id from kunden where name ilike '%kreuztal%' limit 1), (select name from kunden where name ilike '%kreuztal%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%kreuztal%' limit 1), 'Ernst-Moritz-Arndt-Realschule', E'Hessengarten 13\n57223 Kreuztal', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'kreuztal4')
  and exists (select 1 from kunden where name ilike '%kreuztal%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'kreuztal4-p1', 'kreuztal4', '1', 'Glas- und Rahmenreinigung', '2219,19', 'feste_monate', '3,8', 0
where exists (select 1 from glas_objekte where id = 'kreuztal4') on conflict (id) do nothing;

-- Container Schulzentrum
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kreuztal5', (select id from kunden where name ilike '%kreuztal%' limit 1), (select name from kunden where name ilike '%kreuztal%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%kreuztal%' limit 1), 'Container Schulzentrum', E'Zum Erbstollen 5\n57223 Kreuztal', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'kreuztal5')
  and exists (select 1 from kunden where name ilike '%kreuztal%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'kreuztal5-p1', 'kreuztal5', '1', 'Glas- und Rahmenreinigung', '138,63', 'feste_monate', '3,8', 0
where exists (select 1 from glas_objekte where id = 'kreuztal5') on conflict (id) do nothing;

-- Clara-Schumann-Gesamtschule
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kreuztal6', (select id from kunden where name ilike '%kreuztal%' limit 1), (select name from kunden where name ilike '%kreuztal%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%kreuztal%' limit 1), 'Clara-Schumann-Gesamtschule', E'Djurslandweg 2\n57223 Kreuztal', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'kreuztal6')
  and exists (select 1 from kunden where name ilike '%kreuztal%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'kreuztal6-p1', 'kreuztal6', '1', 'Glas- und Rahmenreinigung', '2396,65', 'feste_monate', '3,8', 0
where exists (select 1 from glas_objekte where id = 'kreuztal6') on conflict (id) do nothing;

