-- Stadt Toenisvorst (Glasreinigung, GEKO-Auftrag Los 1): Kunde + 21 Objekte /
-- 26 Positionen aus 5.1_Preisblaetter_neu.xlsx + Losinformationen.pdf (alle Adressen).
-- Gebaeude an derselben Adresse sind EIN Objekt mit mehreren Positionen:
--   Markt 3 (Verwaltungsnebenstelle + Altengaststaette), Wiemespfad 10 (Rudi-Demers-
--   + Josef-Schmitter-Halle), Huelser Str. 51 (GGS + Sporthalle), Corneliusstr. 152
--   (Schule + Sporthalle Kirchenfeld), Corneliusstr. 25 (Schulzentrum + Sporthalle).
-- Intervall: 2x jaehrlich 'nach Absprache Fruehjahr und Herbst' -> feste Monate 4,9
--   (April/September; bei Bedarf einfach im Objekt aendern).
-- Gesamtflaeche 12.410,8 qm - gegen die Preisblatt-Gesamtsumme geprueft.
-- Erstreinigung (SR-Blatt) bewusst nicht angelegt: neue Objekte sind sofort faellig,
--   die erste Reinigung laeuft als erste Intervall-Reinigung.
-- Hilfsmitteleinsatz-Zeilen (Steiger, 0 EUR) nicht uebernommen. Kd.-Nr. leer.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

alter table kunden add column if not exists firma text default 'geko';
alter table glas_objekt_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists pos_text text default '';
alter table glas_objekt_positionen add column if not exists einheit text not null default '';

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-toenisvorst', 'Stadt Tönisvorst', E'47918 Tönisvorst', '', 'glas', 'geko'
where not exists (select 1 from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%')
on conflict (id) do nothing;

-- Verwaltungsgebäude St. Töniser Straße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis1', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verwaltungsgebäude St. Töniser Straße', E'St. Töniser Straße 8\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis1')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis1-p1', 'toenis1', '1', 'Glas- und Rahmenreinigung', '249', 'feste_monate', '4,9', 0, 'geko', E'Sprossenfenster; 20 m² Bleiverglasung', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis1') on conflict (id) do nothing;

-- Verwaltungsnebenstelle + Altengaststätte Vorst
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis2', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verwaltungsnebenstelle + Altengaststätte Vorst', E'Markt 3\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis2')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis2-p1', 'toenis2', '1', 'Glas- und Rahmenreinigung – Verwaltungsnebenstelle', '30', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis2') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis2-p2', 'toenis2', '2', 'Glas- und Rahmenreinigung – Altengaststätte', '80', 'feste_monate', '4,9', 1, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis2') on conflict (id) do nothing;

-- Verwaltungsgebäude Bahnstraße 10
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis3', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verwaltungsgebäude Bahnstraße 10', E'Bahnstraße 10\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis3')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis3-p1', 'toenis3', '1', 'Glas- und Rahmenreinigung', '20', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis3') on conflict (id) do nothing;

-- Städtische Gemeinschaftsgrundschule Vorst
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis4', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Städtische Gemeinschaftsgrundschule Vorst', E'Amselweg 6\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis4')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis4-p1', 'toenis4', '1', 'Glas- und Rahmenreinigung', '1470', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis4') on conflict (id) do nothing;

-- Familienzentrum "Drei-Käse-Hoch"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis5', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Familienzentrum "Drei-Käse-Hoch"', E'Brucknerstraße 16\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis5')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis5-p1', 'toenis5', '1', 'Glas- und Rahmenreinigung', '110', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis5') on conflict (id) do nothing;

-- Jugendtreff Vorst
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis6', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Jugendtreff Vorst', E'Gerkeswiese 40\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis6')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis6-p1', 'toenis6', '1', 'Glas- und Rahmenreinigung', '130', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis6') on conflict (id) do nothing;

-- Rudi-Demers-Halle + Josef-Schmitter-Halle
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis7', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Rudi-Demers-Halle + Josef-Schmitter-Halle', E'Wiemespfad 10\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis7')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis7-p1', 'toenis7', '1', 'Glas- und Rahmenreinigung – Rudi-Demers-Halle', '110', 'feste_monate', '4,9', 0, 'geko', E'80 m² Glasfassade', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis7') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis7-p2', 'toenis7', '2', 'Glas- und Rahmenreinigung – Josef-Schmitter-Halle', '20', 'feste_monate', '4,9', 1, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis7') on conflict (id) do nothing;

-- Verwaltungsgebäude Bahnstraße 15
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis8', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verwaltungsgebäude Bahnstraße 15', E'Bahnstraße 15\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis8')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis8-p1', 'toenis8', '1', 'Glas- und Rahmenreinigung', '450', 'feste_monate', '4,9', 0, 'geko', E'Sprossenfenster; 20 m² Bleiverglasung', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis8') on conflict (id) do nothing;

-- Rathaus Hochstraße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis9', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Rathaus Hochstraße', E'Hochstraße 20a\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis9')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis9-p1', 'toenis9', '1', 'Glas- und Rahmenreinigung', '380', 'feste_monate', '4,9', 0, 'geko', E'80 m² Glasfassade', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis9') on conflict (id) do nothing;

-- Verwaltungsgebäude Hospitalstraße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis10', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Verwaltungsgebäude Hospitalstraße', E'Hospitalstraße 15\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis10')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis10-p1', 'toenis10', '1', 'Glas- und Rahmenreinigung', '130', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis10') on conflict (id) do nothing;

-- GGS + Sporthalle Hülser Straße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis11', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'GGS + Sporthalle Hülser Straße', E'Hülser Straße 51\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis11')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis11-p1', 'toenis11', '1', 'Glas- und Rahmenreinigung – Grundschule', '830', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis11') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis11-p2', 'toenis11', '2', 'Glas- und Rahmenreinigung – Sporthalle', '250', 'feste_monate', '4,9', 1, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis11') on conflict (id) do nothing;

-- Städtischer Bauhof
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis12', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Städtischer Bauhof', E'Tackweg 2\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis12')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis12-p1', 'toenis12', '1', 'Glas- und Rahmenreinigung', '20', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis12') on conflict (id) do nothing;

-- Gemeinschaftsgrundschule Corneliusstraße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis13', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Gemeinschaftsgrundschule Corneliusstraße', E'Corneliusstraße 200\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis13')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis13-p1', 'toenis13', '1', 'Glas- und Rahmenreinigung', '791,8', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis13') on conflict (id) do nothing;

-- Katholische Grundschule St. Tönis Schulstraße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis14', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Katholische Grundschule St. Tönis Schulstraße', E'Schulstraße 13\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis14')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis14-p1', 'toenis14', '1', 'Glas- und Rahmenreinigung', '910', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis14') on conflict (id) do nothing;

-- Kindertagesstätte "Mullewapp"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis15', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Kindertagesstätte "Mullewapp"', E'Feldstraße 2a\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis15')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis15-p1', 'toenis15', '1', 'Glas- und Rahmenreinigung', '130', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis15') on conflict (id) do nothing;

-- Kindertagesstätte "Wiesenzauber"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis16', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Kindertagesstätte "Wiesenzauber"', E'Feldstraße 2b\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis16')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis16-p1', 'toenis16', '1', 'Glas- und Rahmenreinigung', '120', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis16') on conflict (id) do nothing;

-- Städtischer Kindergarten "Panama"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis17', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Städtischer Kindergarten "Panama"', E'Benrader Straße 63e\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis17')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis17-p1', 'toenis17', '1', 'Glas- und Rahmenreinigung', '170', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis17') on conflict (id) do nothing;

-- Familienzentrum "Villa Gänseblümchen"
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis18', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Familienzentrum "Villa Gänseblümchen"', E'Ingerstraße 9\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis18')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis18-p1', 'toenis18', '1', 'Glas- und Rahmenreinigung', '110', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis18') on conflict (id) do nothing;

-- Jugendfreizeitzentrum St. Tönis
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis19', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Jugendfreizeitzentrum St. Tönis', E'Geldener Straße 61\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis19')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis19-p1', 'toenis19', '1', 'Glas- und Rahmenreinigung – Außenglas', '270', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis19') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis19-p2', 'toenis19', '2', 'Glasreinigung – Innenglas (innenliegender Windfang)', '20', 'feste_monate', '4,9', 1, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis19') on conflict (id) do nothing;

-- Schule + Sporthalle Kirchenfeld
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis20', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Schule + Sporthalle Kirchenfeld', E'Corneliusstraße 152\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis20')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis20-p1', 'toenis20', '1', 'Glas- und Rahmenreinigung – Schule', '1260', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis20') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis20-p2', 'toenis20', '2', 'Glas- und Rahmenreinigung – Sporthalle', '170', 'feste_monate', '4,9', 1, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis20') on conflict (id) do nothing;

-- Schulzentrum + Sporthalle Corneliusfeld
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'toenis21', k.id, k.name, k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end, 'Schulzentrum + Sporthalle Corneliusfeld', E'Corneliusstraße 25\n47918 Tönisvorst', '', '', '', 'geko', null, null
from (select id, name, adresse from kunden where id = 'kunde-toenisvorst' or name ilike '%tönisvorst%' limit 1) k
where not exists (select 1 from glas_objekte where id = 'toenis21')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis21-p1', 'toenis21', '1', 'Glas- und Rahmenreinigung – Schulzentrum', '3910', 'feste_monate', '4,9', 0, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis21') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'toenis21-p2', 'toenis21', '2', 'Glas- und Rahmenreinigung – Sporthalle', '270', 'feste_monate', '4,9', 1, 'geko', E'', 'qm'
where exists (select 1 from glas_objekte where id = 'toenis21') on conflict (id) do nothing;

