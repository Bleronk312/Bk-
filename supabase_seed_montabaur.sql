-- Verbandsgemeinde & Stadt Montabaur (Glasreinigung, Los 8) - Kd.-Nr. 1073.
-- Quelle: GEKO_Objektliste_Los8_Glasreinigung_Montabaur.xlsx (Vergabe-Nr. 2026_3007).
-- 12 Objekte, je Pos. 1 'Glas- und Rahmenreinigung', beidseitig einschliesslich Rahmen.
-- qm = einseitig gemessene Glasflaeche laut Preisblatt, centgenau uebernommen.
--   Kontrollsumme aller 12 Objekte: 9169,18 qm = SUMME-Zeile der Objektliste.
-- Intervall 2x jaehrlich: Schulen/Turnhallen April + Oktober (Oster-/Herbstferien),
--   Verbandsgemeinde-Haus Maerz + September (frei terminierbar).
--
-- VERTRAGSLAUFZEIT 01.10.2026 - 30.09.2028 (Option bis 30.09.2030):
--   Die Schulen werden dadurch automatisch erstmals im Oktober 2026 faellig - passt
--   genau zum Vertragsbeginn. Nur das Verbandsgemeinde-Haus waere mit Monat 9 schon
--   im September 2026 und damit VOR Vertragsbeginn faellig geworden; es bekommt
--   deshalb faelligkeit_override = 2027-03-01 (erster Termin im Vertragszeitraum).
--   Beim ersten Unterschreiben loescht die App den Override automatisch.
--   Soll stattdessen schon im Herbst 2026 gereinigt werden, einfach:
--     update glas_objekt_positionen set faelligkeit_override = '2026-10-01' where id = 'mont11-p1';
--
-- Vorlage/Firma: geko. Koordinaten ergaenzt die Admin-Seite automatisch.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

alter table kunden add column if not exists firma text default 'geko';
alter table glas_objekt_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists pos_text text default '';
alter table glas_objekt_positionen add column if not exists einheit text not null default '';

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-montabaur', 'Verbandsgemeinde Montabaur', E'Gerberhof 1\n56410 Montabaur', '1073', 'glas', 'geko'
where not exists (select 1 from kunden where id = 'kunde-montabaur' or kdnr = '1073')
on conflict (id) do nothing;

-- Obj. 1: GS Am Hähnchen (524,97 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont1', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'GS Am Hähnchen', E'Gartenstraße 13\n56412 Niederelbert', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont1')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont1-p1', 'mont1', '1', 'Glas- und Rahmenreinigung', '524,97', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont1') on conflict (id) do nothing;

-- Obj. 2: Augstschule (631,66 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont2', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Augstschule', E'Eitelborner Straße 22\n56335 Neuhäusel', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont2')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont2-p1', 'mont2', '1', 'Glas- und Rahmenreinigung', '631,66', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont2') on conflict (id) do nothing;

-- Obj. 3: GS Eisenbachtal Girod (240,99 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont3', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'GS Eisenbachtal Girod', E'Schulstraße 17\n56412 Girod', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont3')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont3-p1', 'mont3', '1', 'Glas- und Rahmenreinigung', '240,99', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont3') on conflict (id) do nothing;

-- Obj. 4: RS Freiherr vom Stein (935,24 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont4', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'RS Freiherr vom Stein', E'Rheinstraße 12-14\n56412 Nentershausen', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont4')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont4-p1', 'mont4', '1', 'Glas- und Rahmenreinigung', '935,24', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont4') on conflict (id) do nothing;

-- Obj. 5: GS Am Ahrbach (281,22 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont5', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'GS Am Ahrbach', E'Schulstraße 25b\n56412 Ruppach-Goldhausen', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont5')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont5-p1', 'mont5', '1', 'Glas- und Rahmenreinigung', '281,22', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont5') on conflict (id) do nothing;

-- Obj. 6: Heinrich-Roth-Schule (1381,45 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont6', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Heinrich-Roth-Schule', E'Humboldtstraße 5\n56410 Montabaur', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont6')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont6-p1', 'mont6', '1', 'Glas- und Rahmenreinigung', '1381,45', 'feste_monate', '4,10', 0, 'geko', E'Höchste Einzelscheibe 10,45 m – Zugangstechnik prüfen', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont6') on conflict (id) do nothing;

-- Obj. 7: GS Im Buchfinkenland Horbach (396,53 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont7', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'GS Im Buchfinkenland Horbach', E'Schulstraße 17\n56412 Horbach', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont7')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont7-p1', 'mont7', '1', 'Glas- und Rahmenreinigung', '396,53', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont7') on conflict (id) do nothing;

-- Obj. 8: Joseph-Kehrein-Schule (798,80 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont8', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Joseph-Kehrein-Schule', E'Gelbachstraße 1\n56410 Montabaur', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont8')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont8-p1', 'mont8', '1', 'Glas- und Rahmenreinigung', '798,80', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont8') on conflict (id) do nothing;

-- Obj. 9: Kastanienschule Welschneudorf (193,87 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont9', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Kastanienschule Welschneudorf', E'Schulstraße 9\n56412 Welschneudorf', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont9')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont9-p1', 'mont9', '1', 'Glas- und Rahmenreinigung', '193,87', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont9') on conflict (id) do nothing;

-- Obj. 10: GS Pfarrer Toni Sode (417,05 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont10', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'GS Pfarrer Toni Sode', E'Aarstraße 11\n56412 Nentershausen', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont10')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont10-p1', 'mont10', '1', 'Glas- und Rahmenreinigung', '417,05', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont10') on conflict (id) do nothing;

-- Obj. 11: Verbandsgemeinde-Haus (2785,68 qm, Monate 3,9)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont11', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verbandsgemeinde-Haus', E'Gerberhof 1\n56410 Montabaur', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont11')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont11-p1', 'mont11', '1', 'Glas- und Rahmenreinigung', '2785,68', 'feste_monate', '3,9', 0, 'geko', E'Verwaltungsgebäude, 5 Geschosse; frei terminierbar', 'qm', '2027-03-01'
where exists (select 1 from glas_objekte where id = 'mont11') on conflict (id) do nothing;

-- Obj. 12: Waldschule (581,72 qm, Monate 4,10)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'mont12', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Waldschule', E'Buchenstraße 52\n56410 Montabaur-Horressen', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-montabaur' or kdnr = '1073' limit 1) k
where not exists (select 1 from glas_objekte where id = 'mont12')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit, faelligkeit_override)
select 'mont12-p1', 'mont12', '1', 'Glas- und Rahmenreinigung', '581,72', 'feste_monate', '4,10', 0, 'geko', E'', 'qm', null
where exists (select 1 from glas_objekte where id = 'mont12') on conflict (id) do nothing;

-- Kontrolle: alle Montabaur-Objekte mit qm (Summe muss 9169,18 ergeben)
select o.name as objekt, o.adresse, p.qm, p.feste_monate, p.faelligkeit_override
from glas_objekt_positionen p join glas_objekte o on o.id = p.objekt_id
where o.kunde_id in (select id from kunden where id = 'kunde-montabaur' or kdnr = '1073')
order by o.name;
select round(sum(replace(qm,',','.')::numeric),2) as summe_qm
from glas_objekt_positionen p join glas_objekte o on o.id = p.objekt_id
where o.kunde_id in (select id from kunden where id = 'kunde-montabaur' or kdnr = '1073');
