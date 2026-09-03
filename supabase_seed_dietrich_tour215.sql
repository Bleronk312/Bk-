-- Dietrich Tour 215 (Druck_Arbeitsscheine215.PDF, 12.08.2026): 7 neue Dietrich-Kunden,
-- 17 Objekte (21 Scheine), 42 Positionen - schein-treu aus den Original-Abnahmebescheinigungen:
--   Briefkopf je Objekt exakt wie gedruckt (bei St. Rochus laufen St. Clemens GmbH und
--   St. Nikolaus GmbH als eigene Briefkoepfe unter Kd.-Nr. 3319 - EIN Kunde),
--   Objekt-/Bereichsnummer wie gedruckt (z.B. '500 00'; Warendorf '507 10'),
--   Positionsnummern/-texte woertlich, qm centgenau, Stangensystem mit Einheit Std.
-- Kontrollsummen gegen die gedruckten Gesamtflaechen geprueft (Rochus 3649,80 + Maria
--   Hilf 422,50, Wohnpark 847,67, Graf Recke 386,06).
-- Intervalle (August-Tour): 4x = 2,5,8,11 | 2x = 2,8 | 1x = 8. Stangensystem/Hubsteiger
--   laufen im Objekt-Rhythmus mit. Ev. Krankenhaus BG (2070): nur Osmosegeraet OHNE
--   Intervall (manuell waehlbar). L'Oreal: Auftrags-Nr. weggelassen, Massnahme-Nr. beim AP.
--   Casa Reha: KST in den Kundenstammdaten. Kita-Zweckverband 3806/570 existiert bereits
--   identisch (unveraendert). St. Rochus Objekt 500 = ein Objekt inkl.
--   Maria-Hilf-Positionen 50/60/70/778 (Dietrich druckt dafuer einen zweiten Schein, Bereich 50).
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

alter table kunden add column if not exists firma text default 'geko';
alter table glas_objekt_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists pos_text text default '';
alter table glas_objekt_positionen add column if not exists einheit text not null default '';

-- ==================== Graf Recke Quartier Leverkusen gGmbH (Haupt-Kd.-Nr. 1513) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-graf-recke-lev', 'Graf Recke Quartier Leverkusen gGmbH', E'Einbrunger Str.82\n40489 Düsseldorf', '1513', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-graf-recke-lev' or kdnr = '1513')
on conflict (id) do nothing;

-- Objekt 1513 500 00: Graf Recke Quartier Leverkusen (Ulrichstr. 7)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr1513-500', (select id from kunden where id = 'kunde-graf-recke-lev' or kdnr = '1513' limit 1), 'Graf Recke Quartier Leverkusen gGmbH', E'Graf Recke Quartier\nLeverkusen gGmbH\nEinbrunger Str.82\n40489 Düsseldorf', 'Graf Recke Quartier Leverkusen (Ulrichstr. 7)', E'Ulrichstr. 7\n51397 Leverkusen', '500 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-graf-recke-lev' or kdnr = '1513' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr1513-500')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr1513-500-p20', 'dtr1513-500', '20', 'Rahmenreinigung 1x jährl.', '', 'feste_monate', '8', 0, 'sub', E'abzüglich Wohnbereich 4', ''
where exists (select 1 from glas_objekte where id = 'dtr1513-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr1513-500-p40', 'dtr1513-500', '40', 'Rahmenreinigung 1x jährl.', '386,06', 'feste_monate', '8', 1, 'sub', E'Neubau', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr1513-500') on conflict (id) do nothing;

-- ==================== Horizon Development GmbH (Haupt-Kd.-Nr. 2062) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-horizon-dev', 'Horizon Development GmbH', E'Effnerstr. 46, 81925 München\nPostfach 11 01 37\n40501 Düsseldorf', '2062', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-horizon-dev' or kdnr = '2062')
on conflict (id) do nothing;

-- Objekt 2062 500 00: Objekt (L'Oreal)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2062-500', (select id from kunden where id = 'kunde-horizon-dev' or kdnr = '2062' limit 1), 'Horizon Development GmbH', E'Horizon Development GmbH\nEffnerstr. 46, 81925 München\nPostfach 11 01 37\n40501 Düsseldorf', 'Objekt (L''Oreal)', E'Johannstr. 1\n40476 Düsseldorf', '500 00', 'Herr Hucks · Maßnahme-Nr.: MA039539', '0176 30094305', 'sub', null, null
where (select id from kunden where id = 'kunde-horizon-dev' or kdnr = '2062' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr2062-500')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2062-500-p10', 'dtr2062-500', '10', 'Vorhangfassade außen', '12715', 'feste_monate', '2,8', 0, 'sub', E'2x jährl. 12715 qm\nHochhaus Etage 2-15\nDurchführung mithilfe der Befahranlage\nVordruck Fertigstellungsanzeige muß vorab an die AG gefaxt werden und ist dann der Rechnung im Original beizufügen !!!\nAlle Rechnungsanlagen müssen in 2-facher Ausfertigung mitgeschickt werden.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2062-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2062-500-p15', 'dtr2062-500', '15', 'Vorhangfassade innen', '12715', 'feste_monate', '2,8', 1, 'sub', E'2x jährl. 12715 qm\nHochhaus Etage 2-15', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2062-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2062-500-p20', 'dtr2062-500', '20', 'Fenster innen beidseitig', '12715', 'feste_monate', '2,8', 2, 'sub', E'2x jährl. 12715 qm\nHochhaus Etage 2-15', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2062-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2062-500-p30', 'dtr2062-500', '30', 'Fassade Hochhaus Et.EG-1', '572', 'feste_monate', '2,8', 3, 'sub', E'2x jährl. 572 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2062-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2062-500-p40', 'dtr2062-500', '40', 'Fenster beidseitig Flachbau', '1916', 'feste_monate', '2,8', 4, 'sub', E'2x jährl. 1916 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2062-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2062-500-p777', 'dtr2062-500', '777', 'Technik Flachbau', '1916', 'feste_monate', '2,8', 5, 'sub', E'2x jährl. 1916 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2062-500') on conflict (id) do nothing;

-- ==================== Ev. Krankenhaus Bergisch Gladbach gGmbH (Haupt-Kd.-Nr. 2070) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-ev-kh-bg', 'Ev. Krankenhaus Bergisch Gladbach gGmbH', E'Ferrenbergstraße 24\n51465 Bergisch Gladbach', '2070', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-ev-kh-bg' or kdnr = '2070')
on conflict (id) do nothing;

-- Objekt 2070 500 00: Hauptgebäude + Parkhaus
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2070-500', (select id from kunden where id = 'kunde-ev-kh-bg' or kdnr = '2070' limit 1), 'Ev. Krankenhaus Bergisch Gladbach gGmbH', E'Ev. Krankenhaus Bergisch Gladbach\ngGmbH\nFerrenbergstraße 24\n51465 Bergisch Gladbach', 'Hauptgebäude + Parkhaus', E'Ferrenbergstraße 24\n51465 Bergisch Gladbach', '500 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-ev-kh-bg' or kdnr = '2070' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr2070-500')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2070-500-p780', 'dtr2070-500', '780', 'Osmosegerät', '', '', '', 0, 'sub', E'Preis je Ausführung', ''
where exists (select 1 from glas_objekte where id = 'dtr2070-500') on conflict (id) do nothing;

-- ==================== Casa Reha Altenpflegeheim GmbH (Haupt-Kd.-Nr. 2443) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-casa-reha', 'Casa Reha Altenpflegeheim GmbH', E'Postfach 310120\n80101 München\nKST: BK 1410/Segment 4010', '2443', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-casa-reha' or kdnr = '2443')
on conflict (id) do nothing;

-- Objekt 2443 504 00: Haus Gilberhof (Casa Reha Altenpflege GmbH)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2443-504', (select id from kunden where id = 'kunde-casa-reha' or kdnr = '2443' limit 1), 'Casa Reha Altenpflegeheim GmbH', E'Casa Reha Altenpflegeheim GmbH\nPostfach 310120\n80101 München\nKST: BK 1410/Segment 4010', 'Haus Gilberhof (Casa Reha Altenpflege GmbH)', E'Eisenhutstraße 15\n57080 Siegen', '504 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-casa-reha' or kdnr = '2443' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr2443-504')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2443-504-p10', 'dtr2443-504', '10', 'Glas- und Rahmenreinigung', '1120,00', 'feste_monate', '2,8', 0, 'sub', E'2x jährlich / 1.120,00qm\nFalzen Reinigung\nFensterbänke aussen und innen\nStellen der Osmose', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2443-504') on conflict (id) do nothing;

-- ==================== Sana Dreifaltigkeits-Krankenhaus Köln GmbH (Haupt-Kd.-Nr. 2975) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-sana-koeln', 'Sana Dreifaltigkeits-Krankenhaus Köln GmbH', E'Aachener Straße 445 - 449\n50933 Köln', '2975', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-sana-koeln' or kdnr = '2975')
on conflict (id) do nothing;

-- Objekt 2975 500 00: Sana Dreifaltigkeits-Krankenhaus Köln
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr2975-500', (select id from kunden where id = 'kunde-sana-koeln' or kdnr = '2975' limit 1), 'Sana Dreifaltigkeits-Krankenhaus Köln GmbH', E'Sana Dreifaltigkeits-Krankenhaus\nKöln GmbH\nAachener Straße 445 - 449\n50933 Köln', 'Sana Dreifaltigkeits-Krankenhaus Köln', E'Aachener Straße 445 - 449\n50933 Köln', '500 00', 'Herr Keil', '0698 4057282', 'sub', null, null
where (select id from kunden where id = 'kunde-sana-koeln' or kdnr = '2975' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr2975-500')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2975-500-p10', 'dtr2975-500', '10', 'Glas u. Rahmenreinigung inkl. Falze', '1248,30', 'feste_monate', '2,8', 0, 'sub', E'2x j. / 1248,30 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2975-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2975-500-p20', 'dtr2975-500', '20', 'Glas u. Rahmenreinigung', '20,00', 'feste_monate', '2,8', 1, 'sub', E'Vordach Einfahrt 20,00 qm\n2x jährlich', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2975-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2975-500-p30', 'dtr2975-500', '30', 'Glas u. Rahmenreinigung', '67,50', 'feste_monate', '2,8', 2, 'sub', E'Überdachung zum Krankenhaus 67,50 m2\n2xjährlich', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr2975-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr2975-500-p777', 'dtr2975-500', '777', 'Hubsteigereinsatz', '', 'feste_monate', '2,8', 3, 'sub', E'2x jährlich', ''
where exists (select 1 from glas_objekte where id = 'dtr2975-500') on conflict (id) do nothing;

-- ==================== Heinrich Schütt KG GmbH & Co. (Haupt-Kd.-Nr. 3039) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-schuett', 'Heinrich Schütt KG GmbH & Co.', E'Hafenstraße 10a\n45881 Gelsenkirchen', '3039', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-schuett' or kdnr = '3039')
on conflict (id) do nothing;

-- Objekt 3039 500 00: Heinrich Schütt KG GmbH & Co.
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3039-500', (select id from kunden where id = 'kunde-schuett' or kdnr = '3039' limit 1), 'Heinrich Schütt KG GmbH & Co.', E'Heinrich Schütt KG GmbH & Co.\nHafenstraße 10a\n45881 Gelsenkirchen', 'Heinrich Schütt KG GmbH & Co.', E'Hafenstraße 10a\n45881 Gelsenkirchen', '500 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-schuett' or kdnr = '3039' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3039-500')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3039-500-p10', 'dtr3039-500', '10', 'Glas- und Rahmenreinigung', '417,74', 'feste_monate', '2,5,8,11', 0, 'sub', E'417,74 qm / 4x jährlich', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3039-500') on conflict (id) do nothing;

-- ==================== St. Rochus-Hospital GmbH (Haupt-Kd.-Nr. 3319) ====================
insert into kunden (id, name, adresse, kdnr, bereich, firma)
select 'kunde-st-rochus', 'St. Rochus-Hospital GmbH', E'Am Rochus Hospital 1\n48291 Telgte', '3319', 'glas', 'sub'
where not exists (select 1 from kunden where id = 'kunde-st-rochus' or kdnr = '3319')
on conflict (id) do nothing;

-- Objekt 3319 500 00: St. Rochus-Hospital
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-500', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Rochus-Hospital GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Rochus-Hospital', E'Am Rochus Hospital 1\n48291 Telgte', '500 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-500')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p10', 'dtr3319-500', '10', 'Glas- und Rahmenreinigung', '1973,28', 'feste_monate', '2,8', 0, 'sub', E'SRH / 2x jährlich / 1973,28 qm\n1. und 3. Reinigung:\nSporthalle und Verbindungsgang 216,09 qm\nSaal und Wintergarten 163,53qm\nEingang und Bücherei 84,93 qm\nGymnastikhalle 39,74 qm\nTreppenhaus innen 12,96 qm\nRaucherbalkon 21,07 qm\nBalkon neues Bettenhaus mit Dach 52,18 qm\nWerkstätten und Wäscherei 292,41 qm\nTreppenhäuser bei Cafeteria und im Wohnheim 26,90 qm\nTreppenhaus am Kiosk 25,12 qm\nTreppenhäuser i.HausB 36,28qm\nVerbindungsgang Verwaltung 65,88 qm\nVerbindungsgang zum Bettenhaus B 73,25 qm\nAufzugsvorräume im Bettenhaus B 28,98 qm\nFenster Innenhof EG und 1.OG 133,97 qm\nFenster Innenhof 1.OG 22,70 qm\nSt. Raphael zur Werkstattseite 68,22 qm\nSt. Klara komplett 99,85 qm\nSt. Maria - Schutz rechte Seite 21,71 qm\nSt. Johannes Gladach 12 qm\nSt. Christopherus Gladach 7,50 qm\nWirtschaftsgebäude 468,01 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p30', 'dtr3319-500', '30', 'Glas- und Rahmenreinigung', '757,24', 'feste_monate', '2,5,8,11', 1, 'sub', E'Therapiegebäude / 4x jährlich\nkomplett / 757,24 qm\n(ohne Kellerfenster)\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p40', 'dtr3319-500', '40', 'Glas- und Rahmenreinigung', '317,47', 'feste_monate', '2,5,8,11', 2, 'sub', E'Van-Galen-Haus / 4x jährlich\nkomplett / 317,47 qm:\nHaupteingang 22,27 qm\nFensterfront zur Tankstelle 23,44 qm\nWintergarten 81,25 qm\nFahrradständer 5,07 qm\nBalkone 13,62 qm\nWG 1-4, Bürotrakt, Flure 171,81 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p50', 'dtr3319-500', '50', 'Glas- und Rahmenreinigung', '32,14', 'feste_monate', '2,5,8,11', 3, 'sub', E'Glasdach Schwesternpforte Maria Hilf\n4x jährlich / 32,14 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p60', 'dtr3319-500', '60', 'Glas- und Rahmenreinigung', '36,28', 'feste_monate', '2,8', 4, 'sub', E'Aufzug Schwesternpforte Maria Hilf\n2x jährlich / 36,28 qm', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p70', 'dtr3319-500', '70', 'Glas- und Rahmenreinigung', '354,08', 'feste_monate', '2,5,8,11', 5, 'sub', E'Schwesternwohnheim Maria Hilf\n4x jährlich\nVerbindungsgang mit Türen 96,28 qm\n8 Erker Zimmer rechts + links 119,96 qm\nTreppenhäuser 18,68 qm\nFenster neben Aufzug 6,30 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p80', 'dtr3319-500', '80', 'Glas- und Rahmenreinigung', '85,81', 'feste_monate', '2,5,8,11', 6, 'sub', E'Schwimmbad / 4x jährlich\n85,81 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p90', 'dtr3319-500', '90', 'Glas- und Rahmenreinigung', '516,00', 'feste_monate', '2,5,8,11', 7, 'sub', E'Psychotherapiegebäude / 4x j.\n516,00 qm\n(ohne Kellerfenster)\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p777', 'dtr3319-500', '777', 'Stangensystem', '', 'feste_monate', '2,5,8,11', 8, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-500-p778', 'dtr3319-500', '778', 'Stangensystem (Maria Hilf)', '', 'feste_monate', '2,5,8,11', 9, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-500') on conflict (id) do nothing;

-- Objekt 3319 501 00: St. Clemens GmbH (Clemens Wohnpark)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-501', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Clemens GmbH\nClemensstr. 1\n48291 Telgte', 'St. Clemens GmbH (Clemens Wohnpark)', E'Clemensstr. 1\n48291 Telgte', '501 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-501')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-501-p20', 'dtr3319-501', '20', 'Glas- und Rahmenreinigung', '847,67', 'feste_monate', '2,8', 0, 'sub', E'Clemens Wohnpark / 2x jährlich\n1. und 3. Reinigung mit Zimmer aber ohne Büros:\nAltenheim EG mit Bew.Zimmer ohne Büros 362,18 qm\nAltenheim 1.OG mit Bew.Zimmer ohne Büros 263,31 qm\nAltenheim 2.OG mit Bew.Zimmer ohne Büros 222,18 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-501') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-501-p777', 'dtr3319-501', '777', 'Stangensystem', '', 'feste_monate', '2,8', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-501') on conflict (id) do nothing;

-- Objekt 3319 502 00: St. Rochus-Hospital (Haus Lukas)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-502', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Rochus-Hospital GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Rochus-Hospital (Haus Lukas)', E'Clemensstr. 9\n48291 Telgte', '502 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-502')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-502-p10', 'dtr3319-502', '10', 'Glas- und Rahmenreinigung', '200,66', 'feste_monate', '2,5,8,11', 0, 'sub', E'Haus Lukas / 4x jährlich\n200,66 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-502') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-502-p777', 'dtr3319-502', '777', 'Stangensystem', '', 'feste_monate', '2,5,8,11', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-502') on conflict (id) do nothing;

-- Objekt 3319 503 00: St. Rochus-Hospital (WG Jakoba Doppelhaus)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-503', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Rochus-Hospital GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Rochus-Hospital (WG Jakoba Doppelhaus)', E'Mönkediek 18 + 20\n48291 Telgte', '503 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-503')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-503-p10', 'dtr3319-503', '10', 'Glas- und Rahmenreinigung', '69,52', 'feste_monate', '2,5,8,11', 0, 'sub', E'WG Jakoba Doppelhaus / 4x j.\n69,52 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-503') on conflict (id) do nothing;

-- Objekt 3319 504 00: St. Nikolaus GmbH (Cafe Clemens)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-504', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Nikolaus GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Nikolaus GmbH (Cafe Clemens)', E'Mönkediek 22\n48291 Telgte', '504 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-504')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-504-p10', 'dtr3319-504', '10', 'Glas- und Rahmenreinigung', '29,39', 'feste_monate', '2,5,8,11', 0, 'sub', E'Cafe Clemens / 4x j. 29,39 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-504') on conflict (id) do nothing;

-- Objekt 3319 505 00: St. Nikolaus GmbH (Bahnhof/Bäckerei)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-505', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Nikolaus GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Nikolaus GmbH (Bahnhof/Bäckerei)', E'Bahnhofstr. 53\n48291 Telgte', '505 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-505')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-505-p10', 'dtr3319-505', '10', 'Glas- und Rahmenreinigung', '74,54', 'feste_monate', '2,5,8,11', 0, 'sub', E'Bahnhof / Bäckerei - 4x j.\n74,54 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-505') on conflict (id) do nothing;

-- Objekt 3319 506 00: St. Rochus-Hospital (Tagesklinik Ahlen)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-506', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Rochus-Hospital GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Rochus-Hospital (Tagesklinik Ahlen)', E'Parkstr. 49\n59227 Ahlen', '506 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-506')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-506-p10', 'dtr3319-506', '10', 'Glas- und Rahmenreinigung', '220,43', 'feste_monate', '2,5,8,11', 0, 'sub', E'Tagesklinik Ahlen - 4x j.\n00.32 Gymnastikraum 14,13 qm\n00.54 Speiseraum 42,75 qm\n00.53 Tagesraum 26,22 qm\n00.52 Wandelhalle Fenster 7,05 qm\n00.52 Wandelhalle Dach 37,52qm\n00.39 Flur kleines Dach 9,15qm\n00.57 Windfang 39,48 qm\n10.09 Glasdach OG 11,22 qm\n10.16 Fenster über Speiser. 11,02 qm\nBüros IFD Ahlen Warendorferstr. 81 - 21,90 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-506') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-506-p777', 'dtr3319-506', '777', 'Stangensystem', '', 'feste_monate', '2,5,8,11', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-506') on conflict (id) do nothing;

-- Objekt 3319 507 10: St. Rochus Hospital (Tagesklinik Warendorf)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-507', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Rochus-Hospital GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Rochus Hospital (Tagesklinik Warendorf)', E'Von-Ketteler-Str. 39\n48231 Warendorf', '507 10', 'Frank Schröder', '02504 60279', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-507')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-507-p10', 'dtr3319-507', '10', 'Glas- und Rahmenreinigung', '54,94', 'feste_monate', '2,5,8,11', 0, 'sub', E'Tagesklinik WAF / 4x jährlich\nOberlichter in der Sporthalle 6,58 qm\nVordach an der Sporthalle 6,22 qm\nBrennraum 2,50 qm\nDachkuppeln Eingangsbereich 4,28 qm\nOberlichter Haupteingang 25,77 qm\nKicker Raum 3,54 qm\nTreppenhaus Ambulanz 0,80 qm\nWarteraum 1.OG 2,25 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-507') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-507-p777', 'dtr3319-507', '777', 'Stangensystem', '', 'feste_monate', '2,5,8,11', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-507') on conflict (id) do nothing;

-- Objekt 3319 509 00: St. Clemens GmbH (Clemens Wohnpark – Haus 2 TRH)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-509', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Clemens GmbH\nAm Rochus Hospital 1\n48291 Telgte', 'St. Clemens GmbH (Clemens Wohnpark – Haus 2 TRH)', E'Mönkediek 16\n48291 Telgte', '509 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-509')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-509-p10', 'dtr3319-509', '10', 'Glas- und Rahmenreinigung TRH2', '31,15', 'feste_monate', '2,8', 0, 'sub', E'Clemens Wohnpark / 2x jährlich\n1. und 3. Reinigung mit Zimmer aber ohne Büros:\nHaus 2 TRH inkl. Dachfenster 31,15 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-509') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-509-p777', 'dtr3319-509', '777', 'Stangensystem TRH2', '', 'feste_monate', '2,8', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-509') on conflict (id) do nothing;

-- Objekt 3319 510 00: St. Clemens GmbH (Clemens Wohnpark – Haus 4 TRH)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-510', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Clemens GmbH\nAm Rochus-Hospital 1\n48291 Telgte', 'St. Clemens GmbH (Clemens Wohnpark – Haus 4 TRH)', E'Clemensstr. 5\n48291 Telgte', '510 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-510')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-510-p10', 'dtr3319-510', '10', 'Glas- und Rahmenreinigung TRH4', '9,80', 'feste_monate', '2,8', 0, 'sub', E'Clemens Wohnpark / 2x jährlich\n1. und 3. Reinigung mit Zimmer aber ohne Büros:\nHaus 4 TRH inkl. Dachfenster 9,80 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-510') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-510-p777', 'dtr3319-510', '777', 'Stangensystem TRH4', '', 'feste_monate', '2,8', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-510') on conflict (id) do nothing;

-- Objekt 3319 511 00: St. Clemens GmbH (Clemens Wohnpark – Haus 5 TRH)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'dtr3319-511', (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1), 'St. Rochus-Hospital GmbH', E'St. Clemens GmbH\nAm Rochus-Hospital 1\n48291 Telgte', 'St. Clemens GmbH (Clemens Wohnpark – Haus 5 TRH)', E'Clemensstr. 7\n48291 Telgte', '511 00', '', '', 'sub', null, null
where (select id from kunden where id = 'kunde-st-rochus' or kdnr = '3319' limit 1) is not null and not exists (select 1 from glas_objekte where id = 'dtr3319-511')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-511-p10', 'dtr3319-511', '10', 'Glas- und Rahmenreinigung TRH5', '9,80', 'feste_monate', '2,8', 0, 'sub', E'Clemens Wohnpark / 2x jährlich\n1. und 3. Reinigung mit Zimmer aber ohne Büros:\nHaus 5 TRH inkl. Dachfenster 9,80 qm\nFensterfalzen werden nicht mitgereinigt.', 'qm'
where exists (select 1 from glas_objekte where id = 'dtr3319-511') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, template, pos_text, einheit)
select 'dtr3319-511-p777', 'dtr3319-511', '777', 'Stangensystem TRH5', '', 'feste_monate', '2,8', 1, 'sub', E'', 'std'
where exists (select 1 from glas_objekte where id = 'dtr3319-511') on conflict (id) do nothing;

-- Kita-Zweckverband 3806 / Objekt 570 'St. Laurentius I / 535': bereits vorhanden und
-- identisch (Zum Bauverein 34, Gelsenkirchen, 57,70 qm) - nichts zu tun.
-- (Diese Datei enthaelt bewusst NUR INSERTs: UPDATEs auf Positionen blockiert der
--  Schutz-Trigger geko_schutz_positionen fuer alle, die nicht als Admin eingeloggt sind.)

-- Kontrolle: alle neuen Objekte mit Positionen und qm
select k.kdnr as kd, o.kdnr as obj, o.name as objekt, p.nr as pos, p.art, p.qm, p.einheit, p.feste_monate
from glas_objekt_positionen p join glas_objekte o on o.id = p.objekt_id join kunden k on k.id = o.kunde_id
where k.kdnr in ('1513','2062','2070','2443','2975','3039','3319') order by k.kdnr, o.kdnr, p.reihenfolge;
