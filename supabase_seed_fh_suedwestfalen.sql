-- Fachhochschule Suedwestfalen (Glasreinigung): weitere Objekte (Lose 6-10).
-- Kunde 'Fachhochschule Suedwestfalen' (Kd.-Nr. 1063) und die ersten beiden Objekte
--   (Nr. 1+2, Standort Hagen) sind bereits ueber die App angelegt -> werden NICHT neu
--   erstellt, hier nur verknuepft. Diese Datei fuegt die uebrigen 12 Objekte (Nr. 3-14) hinzu.
-- Alle Objekte: Pos. 1 Glas- und Rahmenreinigung, feste Monate Februar + August (2,8).
--   Die grossen Standorte sind fuer August 2026 schon terminiert (Tourenplanung in der App);
--   der naechste feste Monat ab Anlage ist ohnehin August -> passt automatisch.
-- PLZ recherchiert und verifiziert (Stand 07/2026). AUSNAHME: Maurickestr. 3 (Nr. 14)
--   liess sich nicht sicher verorten -> PLZ/Ort offen, bitte nachtragen.
-- Ansprechpartner/Telefon aus der Excel (nur wo angegeben).
-- Koordinaten werden beim naechsten Oeffnen der Admin-Seite automatisch ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Nr. 3: Iserlohn – Baarstr. 5 (Postgebäude)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw3', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Iserlohn – Baarstr. 5 (Postgebäude)', E'Baarstr. 5\n58636 Iserlohn', '', 'Frau Weisler', '023715661417', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw3')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw3-p1', 'fhsw3', '1', 'Glas- und Rahmenreinigung', '369', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw3')
on conflict (id) do nothing;

-- Nr. 4: Iserlohn – Baarstr. 6
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw4', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Iserlohn – Baarstr. 6', E'Baarstr. 6\n58636 Iserlohn', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw4')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw4-p1', 'fhsw4', '1', 'Glas- und Rahmenreinigung', '422', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw4')
on conflict (id) do nothing;

-- Nr. 5: Iserlohn – Frauenstuhlweg 31 (Geb. A, C, H, U, CFM, M, P, Z, Audimax)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw5', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Iserlohn – Frauenstuhlweg 31 (Geb. A, C, H, U, CFM, M, P, Z, Audimax)', E'Frauenstuhlweg 31\n58644 Iserlohn', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw5')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw5-p1', 'fhsw5', '1', 'Glas- und Rahmenreinigung', '5599', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw5')
on conflict (id) do nothing;

-- Nr. 6: Iserlohn – Kalkofen 6
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw6', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Iserlohn – Kalkofen 6', E'Kalkofen 6\n58638 Iserlohn', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw6')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw6-p1', 'fhsw6', '1', 'Glas- und Rahmenreinigung', '40', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw6')
on conflict (id) do nothing;

-- Nr. 7: Lüdenscheid – Bahnhofsallee 5
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw7', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Lüdenscheid – Bahnhofsallee 5', E'Bahnhofsallee 5\n58507 Lüdenscheid', '', 'Herr Bauer', '0233193306214', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw7')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw7-p1', 'fhsw7', '1', 'Glas- und Rahmenreinigung', '720', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw7')
on conflict (id) do nothing;

-- Nr. 8: Meschede – Lindenstraße 53 (Geb. T12, 1, 2, Hauswirtschaftsdienst)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw8', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Meschede – Lindenstraße 53 (Geb. T12, 1, 2, Hauswirtschaftsdienst)', E'Lindenstraße 53\n59872 Meschede', '', 'Herr Wagner', '029199104180', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw8')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw8-p1', 'fhsw8', '1', 'Glas- und Rahmenreinigung', '3114', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw8')
on conflict (id) do nothing;

-- Nr. 9: Meschede – Jahnstraße 23 (Gebäude 13)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw9', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Meschede – Jahnstraße 23 (Gebäude 13)', E'Jahnstraße 23\n59872 Meschede', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw9')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw9-p1', 'fhsw9', '1', 'Glas- und Rahmenreinigung', '537', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw9')
on conflict (id) do nothing;

-- Nr. 10: Meschede – Jahnstraße 25 (Gebäude 14/Labor)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw10', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Meschede – Jahnstraße 25 (Gebäude 14/Labor)', E'Jahnstraße 25\n59872 Meschede', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw10')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw10-p1', 'fhsw10', '1', 'Glas- und Rahmenreinigung', '30', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw10')
on conflict (id) do nothing;

-- Nr. 11: Soest – Lübecker Ring 2 (Gebäude 1–20)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw11', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Soest – Lübecker Ring 2 (Gebäude 1–20)', E'Lübecker Ring 2\n59494 Soest', '', 'Herr Schluck', '029213783256', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw11')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw11-p1', 'fhsw11', '1', 'Glas- und Rahmenreinigung', '4704', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw11')
on conflict (id) do nothing;

-- Nr. 12: Welver – Im Südfeld 1 (Versuchsgut Merklingsen)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw12', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Welver – Im Südfeld 1 (Versuchsgut Merklingsen)', E'Im Südfeld 1\n59514 Welver', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw12')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw12-p1', 'fhsw12', '1', 'Glas- und Rahmenreinigung', '94', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw12')
on conflict (id) do nothing;

-- Nr. 13: Soest – Detmolder Str. 7
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw13', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Soest – Detmolder Str. 7', E'Detmolder Str. 7\n59494 Soest', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw13')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw13-p1', 'fhsw13', '1', 'Glas- und Rahmenreinigung', '410', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw13')
on conflict (id) do nothing;

-- Nr. 14: Maurickestr. 3   [PLZ/Ort offen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'fhsw14', (select id from kunden where name ilike '%südwestfalen%' limit 1), (select name from kunden where name ilike '%südwestfalen%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%südwestfalen%' limit 1), 'Maurickestr. 3', E'Maurickestr. 3', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'fhsw14')
  and exists (select 1 from kunden where name ilike '%südwestfalen%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'fhsw14-p1', 'fhsw14', '1', 'Glas- und Rahmenreinigung', '100', 'feste_monate', '2,8', 0
where exists (select 1 from glas_objekte where id = 'fhsw14')
on conflict (id) do nothing;

