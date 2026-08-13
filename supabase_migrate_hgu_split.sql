-- Hochschule Geisenheim (Kd.-Nr. 1065): Campus-Sammelobjekt aufteilen in 26 einzelne
-- Gebaeude-Objekte (28 Flaechenpositionen, Summe 9.279 qm = wie bisherige Sammelposition).
-- Gleiches Gebaeude = ein Objekt mit mehreren Positionen: ZIG 6120 (Fenster + Lamellen-
-- fassade), Inst. Pflanzenzuechtung 6401 (Gebaeude + Glas-Eingangsbereich).
-- Jedes Objekt bekommt zusaetzlich Pos. 3 Hubsteiger/Scherenarbeitsbuehne als
-- Bedarfsposition (OHNE Intervall -> nur manuell waehlbar).
-- Reinwasserreinigung haengt NICHT an den Gebaeuden: sie ist EIN eigenes Objekt
-- 'Reinwasserreinigung (Campus)' ganz am Ende - so kann sie pro Tour genau EINMAL
-- mitgenommen werden. Falls eine fruehere Version die Reinwasser-Position schon an
-- Gebaeuden angelegt hat, raeumt diese Datei sie automatisch wieder ab.
-- Intervall der Reinigungspositionen: 4,9 (wie bisher vorlaeufig). Vorlage: geko.
-- Kunde wird ueber Kd.-Nr. 1065 gefunden (nichts neu angelegt); Adresse aller Objekte:
-- Campus Von-Lade-Str. 1. Das alte Sammelobjekt 'hgu1' wird am Ende NUR geloescht,
-- wenn es keinen Verlauf (Scheine) hat - sonst bleibt es stehen (Meldung im Output).
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

alter table glas_objekt_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists pos_text text default '';
alter table glas_objekt_positionen add column if not exists einheit text not null default '';

-- ZIG (Geb. 6120)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6120', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'ZIG (Geb. 6120)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6120')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6120-p1', 'hgu-6120', '1', 'Glas- und Rahmenreinigung – Fensterflächen', '1465', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6120') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6120-p1b', 'hgu-6120', '1', 'Glas- und Rahmenreinigung – Lamellenflächen (Fassade)', '1685', 'feste_monate', '4,9', 1, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6120') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6120-p3', 'hgu-6120', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 2, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6120') on conflict (id) do nothing;

-- Aula (Geb. 5902)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5902', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Aula (Geb. 5902)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5902')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5902-p1', 'hgu-5902', '1', 'Glas- und Rahmenreinigung', '100', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5902') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5902-p3', 'hgu-5902', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5902') on conflict (id) do nothing;

-- Verwaltung (Geb. 5901)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5901', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verwaltung (Geb. 5901)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5901')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5901-p1', 'hgu-5901', '1', 'Glas- und Rahmenreinigung', '190', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5901') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5901-p3', 'hgu-5901', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5901') on conflict (id) do nothing;

-- Müller-Thurgau-Haus (Geb. 5905)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5905', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Müller-Thurgau-Haus (Geb. 5905)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5905')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5905-p1', 'hgu-5905', '1', 'Glas- und Rahmenreinigung', '200', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5905') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5905-p3', 'hgu-5905', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5905') on conflict (id) do nothing;

-- Institut Weinbau (Geb. 6206)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6206', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institut Weinbau (Geb. 6206)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6206')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6206-p1', 'hgu-6206', '1', 'Glas- und Rahmenreinigung', '300', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6206') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6206-p3', 'hgu-6206', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6206') on conflict (id) do nothing;

-- Institut Oenologie (Geb. 6201)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6201', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institut Oenologie (Geb. 6201)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6201')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6201-p1', 'hgu-6201', '1', 'Glas- und Rahmenreinigung', '300', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6201') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6201-p3', 'hgu-6201', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6201') on conflict (id) do nothing;

-- Mensa (Geb. 5912)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5912', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Mensa (Geb. 5912)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5912')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5912-p1', 'hgu-5912', '1', 'Glas- und Rahmenreinigung', '180', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5912') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5912-p3', 'hgu-5912', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5912') on conflict (id) do nothing;

-- Hörsaalgebäude (Geb. 5910)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5910', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Hörsaalgebäude (Geb. 5910)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5910')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5910-p1', 'hgu-5910', '1', 'Glas- und Rahmenreinigung', '600', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5910') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5910-p3', 'hgu-5910', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5910') on conflict (id) do nothing;

-- Hauptbibliothek (Geb. 5911)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5911', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Hauptbibliothek (Geb. 5911)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5911')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5911-p1', 'hgu-5911', '1', 'Glas- und Rahmenreinigung', '230', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5911') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5911-p3', 'hgu-5911', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5911') on conflict (id) do nothing;

-- Monrepos (Geb. 5701)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5701', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Monrepos (Geb. 5701)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5701')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5701-p1', 'hgu-5701', '1', 'Glas- und Rahmenreinigung', '300', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5701') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5701-p3', 'hgu-5701', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5701') on conflict (id) do nothing;

-- Institutsgebäude (Geb. 1000)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-1000', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institutsgebäude (Geb. 1000)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-1000')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1000-p1', 'hgu-1000', '1', 'Glas- und Rahmenreinigung', '1000', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-1000') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1000-p3', 'hgu-1000', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-1000') on conflict (id) do nothing;

-- Institut Obstbau (Geb. 6102)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6102', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institut Obstbau (Geb. 6102)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6102')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6102-p1', 'hgu-6102', '1', 'Glas- und Rahmenreinigung', '200', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6102') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6102-p3', 'hgu-6102', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6102') on conflict (id) do nothing;

-- Institut Pflanzenzüchtung – Rudolf-Hermanns-Haus (Geb. 6301)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6301', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institut Pflanzenzüchtung – Rudolf-Hermanns-Haus (Geb. 6301)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6301')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6301-p1', 'hgu-6301', '1', 'Glas- und Rahmenreinigung', '150', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6301') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6301-p3', 'hgu-6301', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6301') on conflict (id) do nothing;

-- Institut Pflanzenzüchtung (Geb. 6401)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6401', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institut Pflanzenzüchtung (Geb. 6401)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6401')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6401-p1', 'hgu-6401', '1', 'Glas- und Rahmenreinigung', '180', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6401') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6401-p1b', 'hgu-6401', '1', 'Glas- und Rahmenreinigung – Eingangsbereich aus Glas', '80', 'feste_monate', '4,9', 1, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6401') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6401-p3', 'hgu-6401', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 2, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6401') on conflict (id) do nothing;

-- Alte Phytomedizin (Geb. 6101)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6101', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Alte Phytomedizin (Geb. 6101)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6101')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6101-p1', 'hgu-6101', '1', 'Glas- und Rahmenreinigung', '190', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6101') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6101-p3', 'hgu-6101', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6101') on conflict (id) do nothing;

-- Personalrat (Geb. 6002)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6002', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Personalrat (Geb. 6002)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6002')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6002-p1', 'hgu-6002', '1', 'Glas- und Rahmenreinigung', '10', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6002') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6002-p3', 'hgu-6002', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6002') on conflict (id) do nothing;

-- Institut Technik/Werkstatt (Geb. 6003)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6003', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Institut Technik/Werkstatt (Geb. 6003)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6003')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6003-p1', 'hgu-6003', '1', 'Glas- und Rahmenreinigung', '280', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6003') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6003-p3', 'hgu-6003', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6003') on conflict (id) do nothing;

-- Pavillion (Geb. 1005)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-1005', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Pavillion (Geb. 1005)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-1005')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1005-p1', 'hgu-1005', '1', 'Glas- und Rahmenreinigung', '236', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-1005') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1005-p3', 'hgu-1005', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-1005') on conflict (id) do nothing;

-- Monrepos Studio (Geb. 6702)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6702', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Monrepos Studio (Geb. 6702)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6702')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6702-p1', 'hgu-6702', '1', 'Glas- und Rahmenreinigung', '20', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6702') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6702-p3', 'hgu-6702', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6702') on conflict (id) do nothing;

-- Verbinder Zierpflanzenbau (Geb. 1014)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-1014', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verbinder Zierpflanzenbau (Geb. 1014)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-1014')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1014-p1', 'hgu-1014', '1', 'Glas- und Rahmenreinigung', '70', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-1014') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1014-p3', 'hgu-1014', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-1014') on conflict (id) do nothing;

-- Verbinder Gemüsebau (Geb. 1013)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-1013', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verbinder Gemüsebau (Geb. 1013)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-1013')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1013-p1', 'hgu-1013', '1', 'Glas- und Rahmenreinigung', '70', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-1013') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-1013-p3', 'hgu-1013', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-1013') on conflict (id) do nothing;

-- Obstbau Halle (Geb. 6105)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6105', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Obstbau Halle (Geb. 6105)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6105')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6105-p1', 'hgu-6105', '1', 'Glas- und Rahmenreinigung', '80', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6105') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6105-p3', 'hgu-6105', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6105') on conflict (id) do nothing;

-- Logistik & Nachhaltigkeit (Geb. 5924)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5924', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Logistik & Nachhaltigkeit (Geb. 5924)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5924')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5924-p1', 'hgu-5924', '1', 'Glas- und Rahmenreinigung', '239', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5924') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5924-p3', 'hgu-5924', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5924') on conflict (id) do nothing;

-- Hörsaalgebäude (Geb. 5925)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-5925', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Hörsaalgebäude (Geb. 5925)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-5925')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5925-p1', 'hgu-5925', '1', 'Glas- und Rahmenreinigung', '255', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-5925') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-5925-p3', 'hgu-5925', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-5925') on conflict (id) do nothing;

-- PLMS (Geb. 6123)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6123', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'PLMS (Geb. 6123)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6123')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6123-p1', 'hgu-6123', '1', 'Glas- und Rahmenreinigung', '180', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6123') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6123-p3', 'hgu-6123', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6123') on conflict (id) do nothing;

-- Getränketechnisches Zentrum (Geb. 6122)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-6122', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Getränketechnisches Zentrum (Geb. 6122)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-6122')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6122-p1', 'hgu-6122', '1', 'Glas- und Rahmenreinigung', '489', 'feste_monate', '4,9', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-6122') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-6122-p3', 'hgu-6122', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 1, 'geko', ''
where exists (select 1 from glas_objekte where id = 'hgu-6122') on conflict (id) do nothing;

-- Reinwasser als EIN eigenes Objekt am Ende (genau einmal pro Tour mitnehmbar)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu-reinwasser', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Reinwasserreinigung (Campus)', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where kdnr = '1065' or id = 'kunde-hgu-geisenheim' or name ilike '%geisenheim%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'hgu-reinwasser')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, einheit)
select 'hgu-reinwasser-p2', 'hgu-reinwasser', '2', 'Reinwasserreinigung', '', '', '', 0, 'geko', 'qm'
where exists (select 1 from glas_objekte where id = 'hgu-reinwasser') on conflict (id) do nothing;

-- Aufraeumen: Reinwasser-Positionen an den Gebaeuden entfernen, falls eine fruehere
-- Version dieser Datei sie schon angelegt hatte (harmlos, wenn es sie nie gab)
delete from glas_objekt_positionen where objekt_id like 'hgu-%' and objekt_id <> 'hgu-reinwasser' and art = 'Reinwasserreinigung';

-- Altes Campus-Sammelobjekt entfernen - NUR wenn ohne Verlauf und die neuen Objekte da sind
do $$
begin
  if not exists (select 1 from glas_objekte where id = 'hgu-6120') then
    raise notice 'Neue HGU-Objekte fehlen - altes Objekt hgu1 bleibt unangetastet.';
  elsif exists (select 1 from glas_stopps where objekt_id = 'hgu1') then
    raise notice 'hgu1 hat bereits Scheine/Verlauf - NICHT geloescht. Bitte Bescheid geben.';
  else
    delete from glas_objekte where id = 'hgu1';  -- Positionen via on delete cascade
    raise notice 'Altes Sammelobjekt hgu1 (9279 qm in einer Position) geloescht.';
  end if;
end $$;
