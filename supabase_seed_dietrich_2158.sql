-- Dietrich Statusliste 2158 (August-Charge, Tour 215): neue Kunden/Objekte/Positionen
-- + Korrekturen am Bestand aus Liste 2156. Quellen: Statusliste 2158 + Abnahmescheine
-- Tour_215_August.PDF (alle Objektadressen von den Original-Scheinen uebernommen).
--
-- NEUES SCHEMA (nach supabase_fix_dietrich_nummern + kunden_firma + positionen_firma):
--   kunden.kdnr = Haupt-Kd.-Nr. (z.B. 2030) | glas_objekte.kdnr = nur Objekt-Nr. (z.B. 501)
--   kunden.firma = 'sub' | Positionen: template='sub', pos_text = Original-Zusatztext
--   (erscheint im PDF unter der Position), einheit = 'qm' bei Flaechenpositionen.
-- Intervall-Logik (alle N=08/2026 -> August ist ein Termin):
--   4x jaehrlich = 2,5,8,11 | 2x = 2,8 | 3x = 4,8,12 | 1x = 8
-- Ev. Seniorenzentrum Haus an der Juech (Kd. 2070) bewusst NICHT angelegt (nur Steiger/
--   Osmose ohne Intervall) - kommt spaeter auf Zuruf.
-- Duplikate aus Liste 2156 werden NICHT neu angelegt (Hupfer Pos 20; BLB IDs 17692,
--   18092, 18038) - sie bekommen in TEIL A nur das korrigierte 4x-Intervall.
-- Idempotent: stabile IDs + on conflict do nothing; Updates treffen exakte IDs.

-- Schema-Spalten sicherstellen (idempotent, schadet nicht wenn schon vorhanden)
alter table kunden add column if not exists firma text default 'geko';
alter table glas_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists pos_text text default '';
alter table glas_objekt_positionen add column if not exists einheit text not null default '';

-- ============================================================================
-- TEIL A: Korrekturen am Bestand (Liste 2156) - nicht-destruktiv, nur genannte Felder
-- ============================================================================

-- A1) Alle bestehenden 4x-jaehrlich-Positionen von '1,4,7,10' auf '2,5,8,11'
--     (August-Rhythmus laut Tour 215; betrifft Johanniter Wuppertal, DRK Dortmund,
--      Hupfer Empfang, BLB Glastueren/Glasdaecher/Oberlichter). alt -> neu: 1,4,7,10 -> 2,5,8,11
update glas_objekt_positionen set feste_monate = '2,5,8,11'
where id in ('dtr2029-506-p10','dtr2029-507-p10','dtr2584-500-p10','dtr2584-500-p778',
             'dtr2709-500-p20','dtr12881-1240-p50','dtr12881-2606-p50','dtr12881-6843-p30')
  and feste_monate = '1,4,7,10';

-- A2) Adress-Korrekturen laut Original-Scheinen (lat/lng zurueck auf null -> App geocodiert neu)
--     Stawa Kleve Aussenstelle: alt 'nur 47533 Kleve' -> neu Graf-Johann-Str. 13
update glas_objekte set adresse = E'Graf-Johann-Str. 13\n47533 Kleve', lat = null, lng = null
where id = 'dtr12881-2606';
--     Polizei MG Rheydt: alt 'Vierhausstr. 27' (recherchiert) -> neu 'Bahnhofstrasse 64' (Schein)
update glas_objekte set adresse = E'Bahnhofstraße 64\n41236 Mönchengladbach', lat = null, lng = null
where id = 'dtr12881-8522';

-- ============================================================================
-- TEIL B: Neue Kunden / Objekte / Positionen (Statusliste 2158)
-- ============================================================================

-- ==================== AOK Rheinland/Hamburg (Haupt-Kd.-Nr. 1147) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-aok-rheinland', 'AOK Rheinland/Hamburg', E'Wanheimer Str. 72\n40468 Düsseldorf', '1147', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-aok-rheinland')
on conflict (id) do nothing;

-- Objekt 507: Gesch-Stelle Waldbröl
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr1147-507', 'kunde-aok-rheinland', 'AOK Rheinland/Hamburg', E'AOK Rheinland/Hamburg\nWanheimer Str. 72\n40468 Düsseldorf', 'Gesch-Stelle Waldbröl', E'Kaiserstr. 28\n51545 Waldbröl', '507', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-aok-rheinland')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr1147-507-p40', 'dtr1147-507', '40', 'Eingangsbereich mit Windfang', '2,56', 'feste_monate', '2,5,8,11', 0, 'sub', E'beidseitig 4xjährlich 2,56qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr1147-507') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr1147-507-p50', 'dtr1147-507', '50', 'Glas- und Rahmenreinigung', '48,19', 'feste_monate', '2,5,8,11', 1, 'sub', E'mit Rahmen beidseitig 4xjährl.\n48,19 qm\nbitte das 1.OG ausmessen', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr1147-507') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr1147-507-p60', 'dtr1147-507', '60', 'Glaselemente innen', '18,81', 'feste_monate', '2,5,8,11', 2, 'sub', E'beidseitig 4xjährlich 18,81qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr1147-507') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr1147-507-p80', 'dtr1147-507', '80', 'Reinigung Briefkasten und Außenwerbeanlage', '', 'feste_monate', '8', 3, 'sub', E'1x jährlich', ''
where exists (select 1 from glas_objekte where id = 'dtr1147-507') on conflict (id) do nothing;

-- ==================== Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg (Haupt-Kd.-Nr. 2030) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Ohlerhammer 14\n51674 Wiehl', '2030', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;

-- Objekt 501: Kita Holpe
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-501', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Holpe', E'Hauptstr. 12\n51597 Morsbach', '501', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-501-p10', 'dtr2030-501', '10', 'Glas- und Rahmenreinigung', '119,10', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 119,10 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-501') on conflict (id) do nothing;

-- Objekt 502: Kita Talstr.
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-502', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Talstr.', E'Talstr. 65\n51702 Bergneustadt', '502', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-502-p10', 'dtr2030-502', '10', 'Glas- und Rahmenreinigung', '91,95', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 91,95 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-502') on conflict (id) do nothing;

-- Objekt 503: Kita Hunsheim
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-503', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Hunsheim', E'Lehmelsweiher 27\n51580 Reichshof-Hunsheim', '503', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-503-p10', 'dtr2030-503', '10', 'Glas- und Rahmenreinigung', '104,56', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 104,56 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-503') on conflict (id) do nothing;

-- Objekt 504: Kita Bruchermühle
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-504', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Bruchermühle', E'Eschweg 2\n51580 Reichshof-Bruchermühle', '504', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-504-p10', 'dtr2030-504', '10', 'Glas- und Rahmenreinigung', '89,26', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 89,26 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-504') on conflict (id) do nothing;

-- Objekt 505: Kita Börnhausen
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-505', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Börnhausen', E'Börnhausen Berg 18\n51674 Wiehl', '505', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-505-p10', 'dtr2030-505', '10', 'Glas- und Rahmenreinigung', '81,66', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 81,66 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-505') on conflict (id) do nothing;

-- Objekt 506: Kita Bielstein
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-506', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Bielstein', E'Hindenburgstr. 14\n51674 Wiehl-Bielstein', '506', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-506-p10', 'dtr2030-506', '10', 'Glas- und Rahmenreinigung', '111,18', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 111,18 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-506') on conflict (id) do nothing;

-- Objekt 509: Kita Odenspiel
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-509', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Odenspiel', E'Unter der Kirche 1\n51580 Reichshof', '509', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-509-p10', 'dtr2030-509', '10', 'Glas- und Rahmenreinigung', '71,55', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 71,55 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-509') on conflict (id) do nothing;

-- Objekt 510: Kita Bechen
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-510', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Bechen', E'Maria-Rost-Str. 4\n51515 Kürten', '510', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-510-p10', 'dtr2030-510', '10', 'Glas- und Rahmenreinigung', '96,72', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 96,72 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-510') on conflict (id) do nothing;

-- Objekt 511: Kita Hilgen
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-511', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Hilgen', E'Rosenkranz 37\n51399 Burscheid', '511', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-511-p10', 'dtr2030-511', '10', 'Glas- und Rahmenreinigung', '203,73', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 203,73 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-511') on conflict (id) do nothing;

-- Objekt 512: Kita Schützeneich
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-512', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Schützeneich', E'Auf der Schützeneich\n51399 Burscheid', '512', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-512-p10', 'dtr2030-512', '10', 'Glas- und Rahmenreinigung', '261,67', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 261,67 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-512') on conflict (id) do nothing;

-- Objekt 513: Kita Sonnenkamp
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-513', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Sonnenkamp', E'Sonnenkamp 18\n51702 Bergneustadt', '513', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-513-p10', 'dtr2030-513', '10', 'Glas- und Rahmenreinigung', '92,79', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 92,79 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-513') on conflict (id) do nothing;

-- Objekt 514: Kita Nümbrecht
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-514', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Nümbrecht', E'Kapellenweg 2\n51588 Nümbrecht', '514', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-514-p10', 'dtr2030-514', '10', 'Glas- und Rahmenreinigung', '113,48', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 113,48 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-514') on conflict (id) do nothing;

-- Objekt 515: Kita Grötzenberg
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-515', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Grötzenberg', E'Brucher Str. 1\n51588 Nümbrecht-Grötzenberg', '515', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-515-p10', 'dtr2030-515', '10', 'Glas- und Rahmenreinigung', '117,07', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 117,07 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-515') on conflict (id) do nothing;

-- Objekt 516: Kita Morsbach
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-516', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Morsbach', E'Hahner Str. 29\n51597 Morsbach', '516', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-516-p10', 'dtr2030-516', '10', 'Glas- und Rahmenreinigung', '90,67', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 90,67 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-516') on conflict (id) do nothing;

-- Objekt 519: Kita Wildbergerhütte
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-519', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Wildbergerhütte', E'Schulstr. 5\n51580 Reichshof-Wildbergerhütte', '519', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-519-p10', 'dtr2030-519', '10', 'Glas- und Rahmenreinigung', '135,90', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 135,90 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-519') on conflict (id) do nothing;

-- Objekt 521: Kita Berlitzstraße
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2030-521', 'kunde-juh-rv-oberberg', 'Johanniter-Unfall-Hilfe e.V. Regionalverband Rhein.-/Oberberg', E'Johanniter-Unfall-Hilfe e.V.\nRegionalverband Rhein.-/Oberberg\nOhlerhammer 14\n51674 Wiehl', 'Kita Berlitzstraße', E'Berlitzstr. 1a\n51643 Gummersbach', '521', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-juh-rv-oberberg')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2030-521-p20', 'dtr2030-521', '20', 'Glas- und Rahmenreinigung', '258,60', 'feste_monate', '2,5,8,11', 0, 'sub', E'4x jährlich / 258,60 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2030-521') on conflict (id) do nothing;

-- ==================== Procar Automobile Wuppertal GmbH & Co KG (Haupt-Kd.-Nr. 2713) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-procar', 'Procar Automobile Wuppertal GmbH & Co KG', E'Kopernikusstr. 6\n42549 Velbert', '2713', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-procar')
on conflict (id) do nothing;

-- Objekt 500: Procar Automobile (BMW und Mini Vertragshändler)   [Adresse laut Schein: Sprockhoevel]
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2713-500', 'kunde-procar', 'Procar Automobile Wuppertal GmbH & Co KG', E'Procar Automobile Wuppertal\nGmbH & Co KG\nKopernikusstr. 6\n42549 Velbert', 'Procar Automobile (BMW und Mini Vertragshändler)', E'Eichenhofer Weg 1-7\n45549 Sprockhövel', '500', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-procar')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2713-500-p10', 'dtr2713-500', '10', 'Glas- und Rahmenreinigung', '898,32', 'feste_monate', '2,8', 0, 'sub', E'ca. 898,32 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2713-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2713-500-p777', 'dtr2713-500', '777', 'Hubwagen', '', 'feste_monate', '2,8', 1, 'sub', E'je Ausführungstag', ''
where exists (select 1 from glas_objekte where id = 'dtr2713-500') on conflict (id) do nothing;

-- ==================== Werkstatt Lebenshilfe Bergisches Land GmbH (Haupt-Kd.-Nr. 3556) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-lebenshilfe-bl', 'Werkstatt Lebenshilfe Bergisches Land GmbH', E'Altenhöhe 11\n42929 Wermelskirchen', '3556', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-lebenshilfe-bl')
on conflict (id) do nothing;

-- Objekt 511: Werkstatt Lebenshilfe – Obere Remscheider Str.
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3556-511', 'kunde-lebenshilfe-bl', 'Werkstatt Lebenshilfe Bergisches Land GmbH', E'Werkstatt Lebenshilfe\nBergisches Land GmbH\nAltenhöhe 11\n42929 Wermelskirchen', 'Werkstatt Lebenshilfe – Obere Remscheider Str.', E'Obere Remscheider Str. 20-22\n42929 Wermelskirchen', '511', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-lebenshilfe-bl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3556-511-p10', 'dtr3556-511', '10', 'Glas- und Rahmenreinigung', '79', 'feste_monate', '2,8', 0, 'sub', E'2x jährlich / 79 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3556-511') on conflict (id) do nothing;
-- Hinweis: Der Original-Schein fuer Pos. 100 traegt den Briefkopf 'Lebenshilfe Service
-- Bergisches Land gGmbH' (gleiche Anschrift) - Dietrich druckt die Position mit eigenem
-- Rechnungsempfaenger. In der App laeuft sie als zweite Position am selben Objekt.
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3556-511-p100', 'dtr3556-511', '100', 'Glas- und Rahmenreinigung', '34', 'feste_monate', '2,8', 1, 'sub', E'2x jährlich / 34 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3556-511') on conflict (id) do nothing;
-- Objekt 512: Werkstatt Lebenshilfe – Kölner Str.
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3556-512', 'kunde-lebenshilfe-bl', 'Werkstatt Lebenshilfe Bergisches Land GmbH', E'Werkstatt Lebenshilfe\nBergisches Land GmbH\nAltenhöhe 11\n42929 Wermelskirchen', 'Werkstatt Lebenshilfe – Kölner Str.', E'Kölner Str. 30-36\n42929 Wermelskirchen', '512', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-lebenshilfe-bl')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3556-512-p10', 'dtr3556-512', '10', 'Glas- und Rahmenreinigung', '22', 'feste_monate', '2,8', 0, 'sub', E'2x jährlich / 22 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3556-512') on conflict (id) do nothing;

-- ==================== Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10) (Haupt-Kd.-Nr. 12875) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-blb-nrw-12875', 'Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10)', E'47526 Kleve', '12875', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-blb-nrw-12875')
on conflict (id) do nothing;

-- Objekt 1115: FA Wuppertal Elberfeld (Los 2.5, WE 1115/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12875-1115', 'kunde-blb-nrw-12875', 'Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10)', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'FA Wuppertal Elberfeld (Los 2.5, WE 1115/01)', E'Kasinostr. 12\n42103 Wuppertal', '1115', 'Randy Jäger', '0211 61707197', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw-12875')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p10', 'dtr12875-1115', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig', '1351,43', 'feste_monate', '2,5,8,11', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 1351,43qm\nPreis pro Durchführung\nID 9290', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p20', 'dtr12875-1115', '20', 'Glasreinigung von Glastüren, zweiseitig', '232,24', 'feste_monate', '2,8', 1, 'sub', E'alle Flächen inkl. Rahmen\n2x jährlich 232,24qm\nPreis pro Durchführung\nID 9292', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p30', 'dtr12875-1115', '30', 'Glasreinigung von Glastüren, zweiseitig – Innenglas Eingang EG + Treppenhaus 6.OG', '48,90', 'feste_monate', '2,8', 2, 'sub', E'alle Flächen inkl. Rahmen\n2x jährlich 48,90qm\nPreis pro Durchführung\nID 9293', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p40', 'dtr12875-1115', '40', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig – Treppenhaus', '21,18', 'feste_monate', '2,5,8,11', 3, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 21,18qm\nPreis pro Durchführung\nID 36961', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p50', 'dtr12875-1115', '50', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig – Flur 7.OG, TH 1-6 OG, Eingang EG', '47,44', 'feste_monate', '2,5,8,11', 4, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 47,44qm\nPreis pro Durchführung\nID 36962', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p60', 'dtr12875-1115', '60', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig – 1-6 OG Treppenhaus 2', '47,44', 'feste_monate', '2,5,8,11', 5, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 47,44qm\nPreis pro Durchführung\nID 36992', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1115-p777', 'dtr12875-1115', '777', 'Hubsteiger', '', 'feste_monate', '2,5,8,11', 6, 'sub', E'Abrechnung erfolgt nach erbrachtem Einsatz\nPreis pro Durchführung\n4x jährlich\nID 36993', ''
where exists (select 1 from glas_objekte where id = 'dtr12875-1115') on conflict (id) do nothing;

-- Objekt 1255: AG Mettmann Neubau (Los 2.10, WE 1255/03)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12875-1255', 'kunde-blb-nrw-12875', 'Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10)', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'AG Mettmann Neubau (Los 2.10, WE 1255/03)', E'Gartenstr. 7\n40822 Mettmann', '1255', 'Sabine Madel-Baldig', '0211 61707250', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw-12875')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1255-p10', 'dtr12875-1255', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig', '1051,83', 'feste_monate', '2,5,8,11', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 1051,83qm\nPreis pro Durchführung\nID 5981', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1255') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1255-p20', 'dtr12875-1255', '20', 'Glasreinigung von Glastüren, zweiseitig', '82,47', 'feste_monate', '2,5,8,11', 1, 'sub', E'alle Flächen inkl. Rahmen\n4x jährlich 82,47qm\nPreis pro Durchführung\nID 36904', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1255') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1255-p30', 'dtr12875-1255', '30', 'Glasreinigung von Sonderglasflächen, zweiseitig', '77,89', 'feste_monate', '2,5,8,11', 2, 'sub', E'alle Flächen inkl. Rahmen\n77,89qm 4x jährlich\nPreis pro Durchführung\nID 36906', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-1255') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-1255-p777', 'dtr12875-1255', '777', 'Hubsteiger', '', 'feste_monate', '2,5,8,11', 3, 'sub', E'Abrechnung erfolgt nach erbrachtem Einsatz\nPreis pro Durchführung\n4x jährlich\nID 5983', ''
where exists (select 1 from glas_objekte where id = 'dtr12875-1255') on conflict (id) do nothing;

-- Objekt 2466: Amtsgericht Langenfeld (Los 2.10, WE 2466/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12875-2466', 'kunde-blb-nrw-12875', 'Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10)', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'Amtsgericht Langenfeld (Los 2.10, WE 2466/01)', E'Hauptstr. 15\n40764 Langenfeld', '2466', 'Sabine Madel-Baldig', '0211 61707250', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw-12875')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-2466-p10', 'dtr12875-2466', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig', '800,93', 'feste_monate', '2,8', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 800,93qm\nPreis pro Durchführung\nID 36983', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-2466') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-2466-p20', 'dtr12875-2466', '20', 'Glas- u. Fensterreinigung inkl. Rahmen, beidseitig', '96,77', 'feste_monate', '2,8', 1, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 96,77qm\nPreis pro Durchführung\nID 36984', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-2466') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-2466-p30', 'dtr12875-2466', '30', 'Glasreinigung von Glastüren, zweiseitig', '131,59', 'feste_monate', '2,8', 2, 'sub', E'alle Flächen inkl. Rahmen\n2x jährlich 131,59qm\nPreis pro Durchführung\nID 36985', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-2466') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-2466-p777', 'dtr12875-2466', '777', 'Osmosegerät', '', 'feste_monate', '2,8', 3, 'sub', E'Abrechnung erfolgt nach erbrachtem Einsatz\nPreis pro Durchführung\n2x jährlich\nID 36987', ''
where exists (select 1 from glas_objekte where id = 'dtr12875-2466') on conflict (id) do nothing;

-- Objekt 7808: ASD Mettmann (Los 2.10, WE 7808/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12875-7808', 'kunde-blb-nrw-12875', 'Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10)', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'ASD Mettmann (Los 2.10, WE 7808/01)', E'Am Königshof 41\n40822 Mettmann', '7808', 'Iris Roschewski', '0211 61707224', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw-12875')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-7808-p10', 'dtr12875-7808', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, zweiseitig', '61,89', 'feste_monate', '2,5,8,11', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 61,89qm\nPreis pro Durchführung\nID 9315', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-7808') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-7808-p20', 'dtr12875-7808', '20', 'Glasreinigung von Glastüren, zweiseitig', '11,57', 'feste_monate', '2,5,8,11', 1, 'sub', E'alle Flächen inkl. Rahmen\n4x jährlich 11,57qm\nPreis pro Durchführung\nID 9317', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-7808') on conflict (id) do nothing;

-- Objekt 8162: FA Wuppertal Elberfeld (Los 2.5, WE 8162/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12875-8162', 'kunde-blb-nrw-12875', 'Bau- und Liegenschaftsbetrieb NRW (Lose 2.5/2.10)', E'Bau- und Liegenschaftsbetrieb NRW\n47526 Kleve', 'FA Wuppertal Elberfeld (Los 2.5, WE 8162/01)', E'Kasinostr. 24-26\n42109 Wuppertal', '8162', 'Randy Jäger', '0211 61707197', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw-12875')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-8162-p10', 'dtr12875-8162', '10', 'Glas- u. Fensterreinigung inkl. Rahmen, einseitig', '141,15', 'feste_monate', '2,5,8,11', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 141,15qm\nPreis pro Durchführung\nID 9294', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-8162') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12875-8162-p20', 'dtr12875-8162', '20', 'Glasreinigung von Glastüren, zweiseitig', '7,41', 'feste_monate', '2,5,8,11', 1, 'sub', E'alle Flächen inkl. Rahmen\n4x jährlich 7,41qm\nPreis pro Durchführung\nID 36946', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12875-8162') on conflict (id) do nothing;

-- ==================== BLB NRW (12881, Bestandskunde kunde-blb-nrw): Ergaenzungen ====================
-- Objekt 1251: Land- und Amtsgericht Kleve (Los 2.2 WE 1251/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-1251', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\nDuisburg\n47526 Kleve', 'Land- und Amtsgericht Kleve (Los 2.2 WE 1251/01)', E'Schloßberg 1\n47533 Kleve', '1251', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p40', 'dtr12881-1251', '40', 'Glas- u. Fensterreinigung ohne Rahmen, beidseitig', '76,00', 'feste_monate', '2,8', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 76,00qm\nPreis pro Durchführung\nID 18568\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p50', 'dtr12881-1251', '50', 'Glasreinigung von Sonderglasflächen, zweiseitig', '23,88', 'feste_monate', '2,5,8,11', 1, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 23,88qm\nPreis pro Durchführung\nID 18569\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p60', 'dtr12881-1251', '60', 'Reinigung von Glasdächern, -Kuppeln, Vordächern', '58,00', 'feste_monate', '2,5,8,11', 2, 'sub', E'alle Flächen\n4x jährlich 58,00qm\nPreis pro Durchführung\nID 18572\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p70', 'dtr12881-1251', '70', 'Glasreinigung von Glastüren, zweiseitig', '63,44', 'feste_monate', '2,5,8,11', 3, 'sub', E'4x jährlich 63,44qm\nPreis pro Durchführung\nID 18605\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p90', 'dtr12881-1251', '90', 'Glas- und Fensterreinigung Sprossenfenster ohne Rahmen, vierseitig', '92,38', 'feste_monate', '2,8', 4, 'sub', E'alle Flächen\n2x jährlich 92,38qm\nPreis pro Durchführung\nID 29091\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p100', 'dtr12881-1251', '100', 'Glas- und Fensterreinigung Sprossenfenster inkl. Rahmen, zweiseitig', '470,86', 'feste_monate', '2,8', 5, 'sub', E'alle Flächen\n2x jährlich 470,86qm\nPreis pro Durchführung\nID 29092\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p140', 'dtr12881-1251', '140', 'Glas- und Fensterreinigung Sprossenfenster ohne Rahmen, zweiseitig', '6,56', 'feste_monate', '2,8', 6, 'sub', E'alle Flächen\n2x jährlich 6,56qm\nPreis pro Durchführung\nID 33074\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p160', 'dtr12881-1251', '160', 'Glas- und Fensterreinigung – Brunnenabdeckung aus Glas, einseitig', '142,0', 'feste_monate', '2,5,8,11', 7, 'sub', E'142,0 qm / 4x jährlich\nID 45639', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1251-p777', 'dtr12881-1251', '777', 'Hubsteiger', '', 'feste_monate', '2,5,8,11', 8, 'sub', E'Abrechnung erfolgt nach erbrachtem Einsatz\nPreis pro Durchführung\n4x jährlich\nID 18436\nOsmose Einsatz nicht erlaubt!', ''
where exists (select 1 from glas_objekte where id = 'dtr12881-1251') on conflict (id) do nothing;

-- Objekt 1252: Amtsgericht Kleve (Los 2.2 WE 1252/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-1252', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\nDuisburg\n47526 Kleve', 'Amtsgericht Kleve (Los 2.2 WE 1252/01)', E'Dr.-Heinz-Will-Platz 1\n47533 Kleve', '1252', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1252-p20', 'dtr12881-1252', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '3,49', 'feste_monate', '2,8', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 3,49qm\nPreis pro Durchführung\nID 17706', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1252') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1252-p30', 'dtr12881-1252', '30', 'Glas- und Fensterreinigung Sprossenfenster ohne Rahmen, zweiseitig', '62,04', 'feste_monate', '2,8', 1, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 62,04qm\nPreis pro Durchführung\nID 31857', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1252') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1252-p777', 'dtr12881-1252', '777', 'Hubwagen', '', 'feste_monate', '2,5,8,11', 2, 'sub', E'Abrechnung erfolgt nach erbrachtem Einsatz\nPreis pro Durchführung\n4x jährlich\nID 17708', ''
where exists (select 1 from glas_objekte where id = 'dtr12881-1252') on conflict (id) do nothing;

-- Objekt 2759: Polizeipräsidium Mönchengladbach Geb. B (Los 2.2, WE 2759/05)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-2759', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\nDuisburg\n47526 Kleve', 'Polizeipräsidium Mönchengladbach Geb. B (Los 2.2, WE 2759/05)', E'Krefelder Str. 555\n41066 Mönchengladbach', '2759', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-2759-p780', 'dtr12881-2759', '780', 'Osmosegerät für den Innenhof', '', 'feste_monate', '4,8,12', 0, 'sub', E'pro Reinigung\n3x jährlich\nID 45116', ''
where exists (select 1 from glas_objekte where id = 'dtr12881-2759') on conflict (id) do nothing;

-- Objekt 8211: Amtsgericht Kleve Außenstelle (Los 2.2 WE 8211/01)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr12881-8211', 'kunde-blb-nrw', 'Bau- und Liegenschaftsbetrieb NRW', E'Bau- und Liegenschaftsbetrieb NRW\nDuisburg\n47526 Kleve', 'Amtsgericht Kleve Außenstelle (Los 2.2 WE 8211/01)', E'Prinzenhof 2\n47533 Kleve', '8211', '', '', 'sub', null, null
where exists (select 1 from kunden where id = 'kunde-blb-nrw')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-8211-p20', 'dtr12881-8211', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '137,00', 'feste_monate', '2,8', 0, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 137,00qm\nPreis pro Durchführung\nID 18071\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-8211') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-8211-p30', 'dtr12881-8211', '30', 'Reinigung von Glasdächern, -Kuppeln, Vordächern', '40,96', 'feste_monate', '2,5,8,11', 1, 'sub', E'alle Flächen inkl. Fensterbänke\n4x jährlich 40,96qm\nPreis pro Durchführung\nID 18074\nOsmose Einsatz nicht erlaubt!', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-8211') on conflict (id) do nothing;
-- Hubsteiger 8211 ohne eigene Haeufigkeit -> laeuft mit der Hauptposition (2x) mit
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-8211-p777', 'dtr12881-8211', '777', 'Hubsteiger', '', 'feste_monate', '2,8', 2, 'sub', E'Abrechnung erfolgt nach erbrachtem Einsatz\nPreis pro Durchführung\nID 18079\nOsmose Einsatz nicht erlaubt!', ''
where exists (select 1 from glas_objekte where id = 'dtr12881-8211') on conflict (id) do nothing;

-- Neue 'ohne Rahmen'-Positionen an BESTEHENDEN BLB-12881-Objekten (Reihenfolge ab 10,
-- damit sie hinter den vorhandenen Positionen einsortiert werden)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1025-p20', 'dtr12881-1025', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '2080,34', 'feste_monate', '2,8', 10, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 2080,34qm\nPreis pro Durchführung\nID 17679', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1025-p40', 'dtr12881-1025', '40', 'Glas- u. Fensterreinigung ohne Rahmen, vierseitig', '265,21', 'feste_monate', '2,8', 11, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 265,21qm\nPreis pro Durchführung\nID 17682', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1025-p80', 'dtr12881-1025', '80', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '28,56', 'feste_monate', '2,8', 12, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 28,56qm\nPreis pro Durchführung\nID 38479', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1025') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1240-p20', 'dtr12881-1240', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '102,48', 'feste_monate', '2,8', 10, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 102,48qm\nPreis pro Durchführung\nID 17689', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1240') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1240-p40', 'dtr12881-1240', '40', 'Glas- u. Fensterreinigung ohne Rahmen, vierseitig', '176,01', 'feste_monate', '2,8', 11, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 176,01qm\nPreis pro Durchführung\nID 17691', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1240') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-1266-p20', 'dtr12881-1266', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '147,10', 'feste_monate', '2,8', 10, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 147,10qm\nPreis pro Durchführung\nID 17890', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-1266') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-2606-p20', 'dtr12881-2606', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '45,97', 'feste_monate', '2,8', 10, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 45,97qm\nPreis pro Durchführung\nID 18083', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-2606') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-2606-p40', 'dtr12881-2606', '40', 'Glas- u. Fensterreinigung ohne Rahmen, beidseitig', '2,57', 'feste_monate', '2,8', 11, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 2,57qm\nPreis pro Durchführung\nID 18090', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-2606') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-6843-p20', 'dtr12881-6843', '20', 'Glas- u. Fensterreinigung ohne Rahmen, zweiseitig', '145,87', 'feste_monate', '2,8', 10, 'sub', E'alle Flächen inkl. Fensterbänke\n2x jährlich 145,87qm\nPreis pro Durchführung\nID 18037', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-6843') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr12881-8522-p20', 'dtr12881-8522', '20', 'Glas- und Fensterreinigung ohne Rahmen, einseitig – Außenglasreinigung von innen', '278,57', 'feste_monate', '8', 10, 'sub', E'278,57 m², 1x jährlich\nID 47258', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr12881-8522') on conflict (id) do nothing;
