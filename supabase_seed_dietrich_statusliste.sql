-- Dietrich-Kunden (Statusliste Arbeitsscheine 2156): 12 Kunden, 25 Objekte, 63 Positionen.
-- Alle Objekte + Positionen mit Vorlage/Firma 'sub' (Dietrich).
-- Positionsnummern = originale Dietrich-Nummern (Spalte F: 10, 20, ..., 777 Steiger,
--   778/779 Osmosegeraet, 1 SVS); Leistungstexte aus dem AA-Beschreibungstext uebernommen.
-- Dietrich-Kd.-Nr. je Objekt = 'Kundennummer Objektnummer' (Spalte D + Leerzeichen + E),
--   erscheint auf Dietrich-Scheinen; kunden.kdnr bleibt leer.
-- Intervalle: Text der Position massgeblich - 2x jaehrlich = 4,9 (Spalte N) |
--   4x jaehrlich = 1,4,7,10 | monatlich (1. FC Koeln) = 1-12. Sonderpositionen ohne
--   eigene Angabe laufen im Objekt-Intervall mit. qm nur wo im Text angegeben.
-- Adressen: Objektadresse falls vorhanden/recherchiert, sonst Hauptkunden-Adresse.
--   [bitte nachtragen]: StA Kleve Aussenstelle (Strasse), Johanniterhaus Nuembrecht,
--   Tagespflege Marienheide, KORIAN Troisdorf + Landscheid, JUH Tagespflege/Hospiz Wiehl.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Firma-Spalte (GEKO/Dietrich) sicherstellen - idempotent, schadet nicht wenn schon da
alter table glas_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists template text default 'geko';

-- ==================== BioCampus Cologne Grundbesitz GmbH & Co. KG (Kd.-Nr. 1586) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-biocampus', 'BioCampus Cologne Grundbesitz GmbH & Co. KG', E'Nattermannallee 1\n50829 Köln', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-biocampus')
on conflict (id) do nothing;

-- Objekt 1586 501: Gebäude S-19
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr1586-501', 'kunde-biocampus', 'BioCampus Cologne Grundbesitz GmbH & Co. KG', E'BioCampus Cologne Grundbesitz GmbH & Co. KG\nNattermannallee 1\n50829 Köln', 'Gebäude S-19', E'Nattermannallee 1\n50829 Köln', '1586 501', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-biocampus')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1586-501-p10', 'dtr1586-501', '10', 'Glas- und Rahmenreinigung', '2040', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1586-501') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1586-501-p777', 'dtr1586-501', '777', 'Steiger Glas+Rahmen', '', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1586-501') on conflict (id) do nothing;

-- Objekt 1586 502: Gebäude E-04
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr1586-502', 'kunde-biocampus', 'BioCampus Cologne Grundbesitz GmbH & Co. KG', E'BioCampus Cologne Grundbesitz GmbH & Co. KG\nNattermannallee 1\n50829 Köln', 'Gebäude E-04', E'Nattermannallee 1\n50829 Köln', '1586 502', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-biocampus')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1586-502-p10', 'dtr1586-502', '10', 'Glas- und Rahmenreinigung', '2595', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1586-502') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1586-502-p20', 'dtr1586-502', '20', 'Glas- und Rahmenreinigung – Treppenhaus', '234,47', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1586-502') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1586-502-p777', 'dtr1586-502', '777', 'Steiger Treppenhausreinigung (Arbeitshöhe ca. 42,5 m, 1 Einsatztag)', '', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1586-502') on conflict (id) do nothing;

-- ==================== Güde GmbH (Kd.-Nr. 1715) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-guede', 'Güde GmbH', E'Postfach 51 28\n58828 Plettenberg', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-guede')
on conflict (id) do nothing;

-- Objekt 1715 500: Güde GmbH   [Strassen-PLZ 58840 (Excel-PLZ 58828 ist die Postfach-PLZ)]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr1715-500', 'kunde-guede', 'Güde GmbH', E'Güde GmbH\nPostfach 51 28\n58828 Plettenberg', 'Güde GmbH', E'Dieselstr. 8\n58840 Plettenberg', '1715 500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-guede')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1715-500-p10', 'dtr1715-500', '10', 'Glas- und Rahmenreinigung Betrieb (pauschal pro Reinigung)', '', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1715-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1715-500-p20', 'dtr1715-500', '20', 'Glas- und Rahmenreinigung – Büro-/Toilettenfenster, Eingangsbereich bis 3 m Höhe (pauschal pro Reinigung)', '', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1715-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr1715-500-p30', 'dtr1715-500', '30', 'Glas- und Rahmenreinigung – Neuer Hallenbereich (Büro Versand Innenglas, WC/Pausen-/Umkleide-/Waschräume, Eingangsbereiche, Türen)', '77,56', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr1715-500') on conflict (id) do nothing;

-- ==================== Johanniter Unfall Hilfe e.V. (Kd.-Nr. 2029) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-johanniter-wuppertal', 'Johanniter Unfall Hilfe e.V.', E'Wittensteinstr. 53\n42285 Wuppertal', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-johanniter-wuppertal')
on conflict (id) do nothing;

-- Objekt 2029 506: Johanniter UH Wuppertal (506) – Neubau/Altbau   [Name bitte bei Bedarf haendisch anpassen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2029-506', 'kunde-johanniter-wuppertal', 'Johanniter Unfall Hilfe e.V.', E'Johanniter Unfall Hilfe e.V.\nWittensteinstr. 53\n42285 Wuppertal', 'Johanniter UH Wuppertal (506) – Neubau/Altbau', E'Wittensteinstr. 53\n42285 Wuppertal', '2029 506', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-johanniter-wuppertal')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2029-506-p10', 'dtr2029-506', '10', 'Glas- und Rahmenreinigung sowie Außenfensterbank – Neubau/Altbau', '166,08', 'feste_monate', '1,4,7,10', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2029-506') on conflict (id) do nothing;

-- Objekt 2029 507: Johanniter UH Wuppertal (507)   [Name bitte bei Bedarf haendisch anpassen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2029-507', 'kunde-johanniter-wuppertal', 'Johanniter Unfall Hilfe e.V.', E'Johanniter Unfall Hilfe e.V.\nWittensteinstr. 53\n42285 Wuppertal', 'Johanniter UH Wuppertal (507)', E'Wittensteinstr. 53\n42285 Wuppertal', '2029 507', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-johanniter-wuppertal')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2029-507-p10', 'dtr2029-507', '10', 'Glas- und Rahmenreinigung sowie Außenfensterbank', '77,04', 'feste_monate', '1,4,7,10', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2029-507') on conflict (id) do nothing;

-- ==================== Johanniter-Unfall-Hilfe e. V. (Kd.-Nr. 2040) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Ohlerhammer 14\n51674 Wiehl', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;

-- Objekt 2040 501: JUH Geschäftsstelle Wiehl
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2040-501', 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Johanniter-Unfall-Hilfe e. V.\nOhlerhammer 14\n51674 Wiehl', 'JUH Geschäftsstelle Wiehl', E'Ohlerhammer 14\n51674 Wiehl', '2040 501', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-501-p10', 'dtr2040-501', '10', 'Glas- und Rahmenreinigung', '', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-501') on conflict (id) do nothing;

-- Objekt 2040 502: JUH Tagespflege Wiehl   [Objektadresse ggf. nachtragen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2040-502', 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Johanniter-Unfall-Hilfe e. V.\nOhlerhammer 14\n51674 Wiehl', 'JUH Tagespflege Wiehl', E'Ohlerhammer 14\n51674 Wiehl', '2040 502', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-502-p10', 'dtr2040-502', '10', 'Glas- und Rahmenreinigung', '', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-502') on conflict (id) do nothing;

-- Objekt 2040 504: JUH Hospiz Wiehl   [Objektadresse ggf. nachtragen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2040-504', 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Johanniter-Unfall-Hilfe e. V.\nOhlerhammer 14\n51674 Wiehl', 'JUH Hospiz Wiehl', E'Ohlerhammer 14\n51674 Wiehl', '2040 504', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-504-p10', 'dtr2040-504', '10', 'Glas- und Rahmenreinigung', '', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-504') on conflict (id) do nothing;

-- Objekt 2040 505: Johanniterhaus Wiehl
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2040-505', 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Johanniter-Unfall-Hilfe e. V.\nOhlerhammer 14\n51674 Wiehl', 'Johanniterhaus Wiehl', E'Homburger Str. 7\n51674 Wiehl', '2040 505', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-505-p10', 'dtr2040-505', '10', 'Glas- und Rahmenreinigung', '', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-505') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-505-p20', 'dtr2040-505', '20', 'Glasreinigung im Bereich der Balkone (pro Reinigung)', '', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-505') on conflict (id) do nothing;

-- Objekt 2040 508: Johanniterhaus Nümbrecht   [Strasse bitte nachtragen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2040-508', 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Johanniter-Unfall-Hilfe e. V.\nOhlerhammer 14\n51674 Wiehl', 'Johanniterhaus Nümbrecht', E'51588 Nümbrecht', '2040 508', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-508-p10', 'dtr2040-508', '10', 'Glas- und Rahmenreinigung', '252,08', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-508') on conflict (id) do nothing;

-- Objekt 2040 511: Johanniter Tagespflege Marienheide   [Strasse bitte nachtragen; kein Hubsteiger benoetigt]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2040-511', 'kunde-juh-wiehl', 'Johanniter-Unfall-Hilfe e. V.', E'Johanniter-Unfall-Hilfe e. V.\nOhlerhammer 14\n51674 Wiehl', 'Johanniter Tagespflege Marienheide', E'51709 Marienheide', '2040 511', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-wiehl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2040-511-p10', 'dtr2040-511', '10', 'Glas- und Rahmenreinigung (kein Hubsteiger benötigt)', '59,63', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2040-511') on conflict (id) do nothing;

-- ==================== KORIAN Deutschland AG (Kd.-Nr. 2079) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-korian', 'KORIAN Deutschland AG', E'Dingolfinger Str. 15\n81673 München', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-korian')
on conflict (id) do nothing;

-- Objekt 2079 506: Haus Curanum Sieglar, Troisdorf   [Strasse bitte nachtragen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2079-506', 'kunde-korian', 'KORIAN Deutschland AG', E'KORIAN Deutschland AG\nDingolfinger Str. 15\n81673 München', 'Haus Curanum Sieglar, Troisdorf', E'53844 Troisdorf', '2079 506', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-korian')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-506-p10', 'dtr2079-506', '10', 'Glas- und Rahmenreinigung', '2065', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-506') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-506-p20', 'dtr2079-506', '20', 'Fensterbank außen', '', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-506') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-506-p30', 'dtr2079-506', '30', 'Fensterbank innen', '', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-506') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-506-p40', 'dtr2079-506', '40', 'Innenglas', '', 'feste_monate', '4,9', 3, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-506') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-506-p777', 'dtr2079-506', '777', 'Steiger 26 m + Scherenbühne', '', 'feste_monate', '4,9', 4, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-506') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-506-p779', 'dtr2079-506', '779', 'Osmosegerät', '', 'feste_monate', '4,9', 5, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-506') on conflict (id) do nothing;

-- Objekt 2079 509: Zentrum für Betreuung und Pflege am Eifelsteig, Landscheid   [Strasse bitte nachtragen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2079-509', 'kunde-korian', 'KORIAN Deutschland AG', E'KORIAN Deutschland AG\nDingolfinger Str. 15\n81673 München', 'Zentrum für Betreuung und Pflege am Eifelsteig, Landscheid', E'54526 Landscheid', '2079 509', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-korian')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-509-p10', 'dtr2079-509', '10', 'Glas- und Rahmenreinigung', '950', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-509') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-509-p20', 'dtr2079-509', '20', 'Fensterbank außen', '90', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-509') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-509-p30', 'dtr2079-509', '30', 'Fensterbank innen', '90', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-509') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2079-509-p40', 'dtr2079-509', '40', 'Innenglas', '53', 'feste_monate', '4,9', 3, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2079-509') on conflict (id) do nothing;

-- ==================== 1. FC Köln GmbH & Co. KGaA (Kd.-Nr. 2536) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-fc-koeln', '1. FC Köln GmbH & Co. KGaA', E'Franz-Kremer-Allee 1-3\n50937 Köln', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-fc-koeln')
on conflict (id) do nothing;

-- Objekt 2536 500: RheinEnergieSportpark / Geißbockheim (Los 2.1)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2536-500', 'kunde-fc-koeln', '1. FC Köln GmbH & Co. KGaA', E'1. FC Köln GmbH & Co. KGaA\nFranz-Kremer-Allee 1-3\n50937 Köln', 'RheinEnergieSportpark / Geißbockheim (Los 2.1)', E'Franz-Kremer-Allee 1-3\n50937 Köln', '2536 500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-fc-koeln')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2536-500-p10', 'dtr2536-500', '10', 'Glas- und Rahmenreinigung innen und außen – monatlich pauschal (Lizenz, Halle/Kraftraum, Nachwuchs, Verwaltung Nachwuchs, Geschäftsstelle/Fanshop)', '950,18', 'feste_monate', '1,2,3,4,5,6,7,8,9,10,11,12', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2536-500') on conflict (id) do nothing;

-- ==================== Deutsches Rotes Kreuz Kreisverband Dortmund e.V. (Kd.-Nr. 2584) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-drk-dortmund', 'Deutsches Rotes Kreuz Kreisverband Dortmund e.V.', E'Dellwiger Str. 273\n44388 Dortmund', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-drk-dortmund')
on conflict (id) do nothing;

-- Objekt 2584 500: DRK Altenzentrum Dortmund
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2584-500', 'kunde-drk-dortmund', 'Deutsches Rotes Kreuz Kreisverband Dortmund e.V.', E'Deutsches Rotes Kreuz Kreisverband Dortmund e.V.\nDellwiger Str. 273\n44388 Dortmund', 'DRK Altenzentrum Dortmund', E'Dellwiger Str. 273\n44388 Dortmund', '2584 500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-drk-dortmund')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2584-500-p10', 'dtr2584-500', '10', 'Glas- und Rahmenreinigung (pauschal pro Reinigung)', '1937', 'feste_monate', '1,4,7,10', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2584-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2584-500-p778', 'dtr2584-500', '778', 'Osmosegerät (pauschal)', '', 'feste_monate', '1,4,7,10', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2584-500') on conflict (id) do nothing;

-- ==================== Hupfer Metallwerke GmbH & Co. KG (Kd.-Nr. 2709) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-hupfer', 'Hupfer Metallwerke GmbH & Co. KG', E'Dieselstraße 20\n48653 Coesfeld', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-hupfer')
on conflict (id) do nothing;

-- Objekt 2709 500: Hupfer Metallwerke
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2709-500', 'kunde-hupfer', 'Hupfer Metallwerke GmbH & Co. KG', E'Hupfer Metallwerke GmbH & Co. KG\nDieselstraße 20\n48653 Coesfeld', 'Hupfer Metallwerke', E'Dieselstraße 20\n48653 Coesfeld', '2709 500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-hupfer')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p10', 'dtr2709-500', '10', 'Glasreinigung Verwaltung EG (Osmosegerät wird benötigt)', '66,42', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p20', 'dtr2709-500', '20', 'Glasreinigung Verwaltung EG Empfang', '63,03', 'feste_monate', '1,4,7,10', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p30', 'dtr2709-500', '30', 'Glasreinigung Marketingcenter EG', '198,92', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p40', 'dtr2709-500', '40', 'Glasreinigung Verwaltung 1.OG', '142,78', 'feste_monate', '4,9', 3, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p50', 'dtr2709-500', '50', 'Glasreinigung Verwaltung 2.OG', '80,95', 'feste_monate', '4,9', 4, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p60', 'dtr2709-500', '60', 'Glasreinigung Verwaltung DG', '52,04', 'feste_monate', '4,9', 5, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p70', 'dtr2709-500', '70', 'Glasreinigung Büro-/Sozialtrakt EG', '79,69', 'feste_monate', '4,9', 6, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p80', 'dtr2709-500', '80', 'Glasreinigung Büro-/Sozialtrakt 1.OG', '21,56', 'feste_monate', '4,9', 7, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p90', 'dtr2709-500', '90', 'Glasreinigung Konstruktion EG', '42,11', 'feste_monate', '4,9', 8, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p100', 'dtr2709-500', '100', 'Glasreinigung Konstruktion 1.OG', '17,50', 'feste_monate', '4,9', 9, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p110', 'dtr2709-500', '110', 'Glasreinigung Konstruktion 2.OG', '21,23', 'feste_monate', '4,9', 10, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p120', 'dtr2709-500', '120', 'Glasreinigung Sanitärcontainer', '2,00', 'feste_monate', '4,9', 11, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2709-500-p160', 'dtr2709-500', '160', 'Glasreinigung Treppenhaus II Verwaltung', '16,08', 'feste_monate', '4,9', 12, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2709-500') on conflict (id) do nothing;

-- ==================== Bähr Nutzfahrzeuge GmbH (Kd.-Nr. 2744) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-baehr', 'Bähr Nutzfahrzeuge GmbH', E'Hermann-Hollerith-Straße 2\n52249 Eschweiler', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-baehr')
on conflict (id) do nothing;

-- Objekt 2744 500: Bähr Nutzfahrzeuge
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2744-500', 'kunde-baehr', 'Bähr Nutzfahrzeuge GmbH', E'Bähr Nutzfahrzeuge GmbH\nHermann-Hollerith-Straße 2\n52249 Eschweiler', 'Bähr Nutzfahrzeuge', E'Hermann-Hollerith-Straße 2\n52249 Eschweiler', '2744 500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-baehr')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2744-500-p1', 'dtr2744-500', '1', 'SVS Glas', '', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2744-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2744-500-p10', 'dtr2744-500', '10', 'Glas- und Rahmenreinigung außen', '', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2744-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2744-500-p20', 'dtr2744-500', '20', 'Glas- und Rahmenreinigung innen', '', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2744-500') on conflict (id) do nothing;

-- ==================== Raiffeisen Südwestfalen eG (Kd.-Nr. 2883) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-raiffeisen-swf', 'Raiffeisen Südwestfalen eG', E'Frankfurter Str. 73\n58553 Halver', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-raiffeisen-swf')
on conflict (id) do nothing;

-- Objekt 2883 501: Hauptverwaltung
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2883-501', 'kunde-raiffeisen-swf', 'Raiffeisen Südwestfalen eG', E'Raiffeisen Südwestfalen eG\nFrankfurter Str. 73\n58553 Halver', 'Hauptverwaltung', E'Frankfurter Str. 73\n58553 Halver', '2883 501', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-raiffeisen-swf')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr2883-501-p10', 'dtr2883-501', '10', 'Glas- und Rahmenreinigung (mit Osmosegerät)', '193,59', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr2883-501') on conflict (id) do nothing;

-- ==================== Finova Feinschneidtechnik GmbH (Kd.-Nr. 8390) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-finova', 'Finova Feinschneidtechnik GmbH', E'Am Weidenbroich 24\n42897 Remscheid', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-finova')
on conflict (id) do nothing;

-- Objekt 8390 500: Finova Feinschneidtechnik
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr8390-500', 'kunde-finova', 'Finova Feinschneidtechnik GmbH', E'Finova Feinschneidtechnik GmbH\nAm Weidenbroich 24\n42897 Remscheid', 'Finova Feinschneidtechnik', E'Am Weidenbroich 24\n42897 Remscheid', '8390 500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-finova')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr8390-500-p10', 'dtr8390-500', '10', 'Glas- und Rahmenreinigung', '642,29', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr8390-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr8390-500-p20', 'dtr8390-500', '20', 'Stangensystem', '', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr8390-500') on conflict (id) do nothing;

-- ==================== Bau- und Liegenschaftsbetrieb NRW (Kd.-Nr. 12881) ====================
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'47526 Kleve', '', 'glas'
where not exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;

-- Objekt 12881 1025: Finanzamt Kleve (Los 2.2 WE 1025/01)   [Adresse recherchiert]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-1025', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'Finanzamt Kleve (Los 2.2 WE 1025/01)', E'Emmericher Str. 182\n47533 Kleve', '12881 1025', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1025-p10', 'dtr12881-1025', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig, inkl. Fensterbänke (ID 17678)', '2080,34', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1025-p30', 'dtr12881-1025', '30', 'Glas- u. Fensterreinigung inkl. Rahmen, vierseitig, inkl. Fensterbänke (ID 17680)', '265,21', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1025-p50', 'dtr12881-1025', '50', 'Glas- u. Fensterreinigung inkl. Rahmen, beidseitig, inkl. Fensterbänke (ID 17683)', '173,71', 'feste_monate', '4,9', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1025-p70', 'dtr12881-1025', '70', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig, inkl. Fensterbänke (ID 38478)', '40,58', 'feste_monate', '4,9', 3, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;

-- Objekt 12881 1240: Staatsanwaltschaft Kleve (Los 2.2 WE 1240/01)   [Adresse recherchiert]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-1240', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'Staatsanwaltschaft Kleve (Los 2.2 WE 1240/01)', E'Ringstr. 13\n47533 Kleve', '12881 1240', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1240-p10', 'dtr12881-1240', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig, inkl. Fensterbänke (ID 17688)', '102,48', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1240') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1240-p30', 'dtr12881-1240', '30', 'Glas- u. Fensterreinigung inkl. Rahmen, vierseitig, inkl. Fensterbänke (ID 17690)', '176,01', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1240') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1240-p50', 'dtr12881-1240', '50', 'Glasreinigung von Glastüren, zweiseitig (ID 17692)', '45,85', 'feste_monate', '1,4,7,10', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1240') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1240-p60', 'dtr12881-1240', '60', 'Glasreinigung von Sonderglasflächen, zweiseitig (ID 18187)', '5,60', 'feste_monate', '4,9', 3, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1240') on conflict (id) do nothing;

-- Objekt 12881 1266: LANUV Wasserkontrollstation Kleve (Los 2.2 WE 1266/01)   [Rheinmessstation Kleve-Bimmen, Adresse recherchiert]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-1266', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'LANUV Wasserkontrollstation Kleve (Los 2.2 WE 1266/01)', E'Heerstr. 56\n47533 Kleve', '12881 1266', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-1266-p10', 'dtr12881-1266', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig, inkl. Fensterbänke (ID 17888)', '147,10', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-1266') on conflict (id) do nothing;

-- Objekt 12881 2606: Staatsanwaltschaft Kleve Außenstelle (Los 2.2 WE 2606/01)   [Strasse nicht auffindbar - bitte nachtragen]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-2606', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'Staatsanwaltschaft Kleve Außenstelle (Los 2.2 WE 2606/01)', E'47533 Kleve', '12881 2606', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-2606-p10', 'dtr12881-2606', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig, inkl. Fensterbänke (ID 18082)', '45,97', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-2606') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-2606-p30', 'dtr12881-2606', '30', 'Glas- u. Fensterreinigung inkl. Rahmen, beidseitig, inkl. Fensterbänke (ID 18085)', '2,57', 'feste_monate', '4,9', 1, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-2606') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-2606-p50', 'dtr12881-2606', '50', 'Reinigung von Glasdächern, -kuppeln, Vordächern (ID 18092)', '2,79', 'feste_monate', '1,4,7,10', 2, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-2606') on conflict (id) do nothing;

-- Objekt 12881 6843: Ambulanter Sozialer Dienst Kleve (Los 2.2 WE 6843/01)   [Adresse recherchiert]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-6843', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'Ambulanter Sozialer Dienst Kleve (Los 2.2 WE 6843/01)', E'Stechbahn 78-80\n47533 Kleve', '12881 6843', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-6843-p30', 'dtr12881-6843', '30', 'Glasreinigung von Oberlichtern/Lichtbändern, zweiseitig (ID 18038)', '6,15', 'feste_monate', '1,4,7,10', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-6843') on conflict (id) do nothing;

-- Objekt 12881 8522: Polizei MG Rheydt (Los 2.2 WE 8522/01)   [Adresse recherchiert (Polizeiwache Rheydt)]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-8522', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'Polizei MG Rheydt (Los 2.2 WE 8522/01)', E'Vierhausstr. 27\n41236 Mönchengladbach', '12881 8522', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template)
select 'dtr12881-8522-p10', 'dtr12881-8522', '10', 'Glas- und Fensterreinigung inkl. Rahmen, einseitig – Außenglasreinigung (ID 47257)', '278,57', 'feste_monate', '4,9', 0, 'sub'
where exists (select 1 from glas_objekte where id = 'dtr12881-8522') on conflict (id) do nothing;

