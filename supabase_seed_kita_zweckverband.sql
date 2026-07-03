-- KITA Zweckverband: alle Objekte aus der Excel-Liste (Bochum, Gelsenkirchen,
-- Hattingen, Lüdenscheid, Divers) als Glas-Objekte mit Pos. 10 (qm insgesamt).
-- Sicher mehrfach ausführbar: bereits vorhandene Kd.-Nummern werden übersprungen.
-- Koordinaten werden beim nächsten Öffnen der Admin-Seite automatisch ergänzt.
-- In Supabase SQL Editor einfügen -> Run.

-- Vorlage-Spalte (Schein-Template je Objekt, 'geko' oder 'sub' = Dietrich)
alter table glas_objekte add column if not exists template text not null default 'geko';

-- Kunde anlegen, falls es ihn noch nicht gibt
alter table kunden add column if not exists bereich text not null default 'beide';
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-kita-zweckverband', 'KITA Zweckverband', '', '', 'glas'
where not exists (select 1 from kunden where name ilike '%zweckverband%');

-- Bochum: St. Peter und Paul / 401
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv511', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Peter und Paul / 401', E'Bleichstraße 10 a\n44787 Bochum', '3806 511 00', 'Martina Klein', '0234 67239', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 511 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv511-p10', 'kzv511', '10', 'Glas- und Rahmenreinigung', '87,6', '', 0
where exists (select 1 from glas_objekte where id = 'kzv511')
on conflict (id) do nothing;

-- Bochum: St. Joseph / 400
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv588', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Joseph / 400', E'Stühmeyerstraße 45 b\n44787 Bochum', '3806 588 00', '', '0234 67974', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 588 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv588-p10', 'kzv588', '10', 'Glas- und Rahmenreinigung', '85', '', 0
where exists (select 1 from glas_objekte where id = 'kzv588')
on conflict (id) do nothing;

-- Bochum: Christ König / 402
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv589', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Christ König / 402', E'Düppelstraße 49 a\n44789 Bochum', '3806 589 00', '', '0234 2984889', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 589 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv589-p10', 'kzv589', '10', 'Glas- und Rahmenreinigung', '88,38', '', 0
where exists (select 1 from glas_objekte where id = 'kzv589')
on conflict (id) do nothing;

-- Bochum: Heilig Kreuz / 404
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv512', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilig Kreuz / 404', E'Castroper Straße 237\n44791 Bochum', '3806 512 00', 'Claudia Heidusch', '0234 592197', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 512 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv512-p10', 'kzv512', '10', 'Glas- und Rahmenreinigung', '47,65', '', 0
where exists (select 1 from glas_objekte where id = 'kzv512')
on conflict (id) do nothing;

-- Bochum: St. Anna / 407
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv590', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Anna / 407', E'Goldhammer Straße 14 a\n44793 Bochum', '3806 590 00', '', '0234 14050', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 590 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv590-p10', 'kzv590', '10', 'Glas- und Rahmenreinigung', '144', '', 0
where exists (select 1 from glas_objekte where id = 'kzv590')
on conflict (id) do nothing;

-- Bochum: Heilige Familie / 409
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv513', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilige Familie / 409', E'Karl-Friedrich-Straße 107\n44795 Bochum', '3806 513 00', 'Angela Schomberg', '0234 472854', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 513 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv513-p10', 'kzv513', '10', 'Glas- und Rahmenreinigung', '93', '', 0
where exists (select 1 from glas_objekte where id = 'kzv513')
on conflict (id) do nothing;

-- Bochum: St. Franziskus / 410
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv514', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Franziskus / 410', E'Wasserstraße 470\n44795 Bochum', '3806 514 00', 'Monika Orth', '0234 432929', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 514 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv514-p10', 'kzv514', '10', 'Glas- und Rahmenreinigung', '71,4', '', 0
where exists (select 1 from glas_objekte where id = 'kzv514')
on conflict (id) do nothing;

-- Bochum: St. Marien Gräfin Imma / 411
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv515', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Marien Gräfin Imma / 411', E'Am Brunen 10\n44797 Bochum', '3806 515 00', 'Ursula Noll', '0234 793690', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 515 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv515-p10', 'kzv515', '10', 'Glas- und Rahmenreinigung', '106', '', 0
where exists (select 1 from glas_objekte where id = 'kzv515')
on conflict (id) do nothing;

-- Bochum: St. Johannes / 413
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv516', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Johannes / 413', E'Brenscheder Straße 43 c\n44799 Bochum', '3806 516 00', 'Sabina Höffner', '0234 75254', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 516 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv516-p10', 'kzv516', '10', 'Glas- und Rahmenreinigung', '134,46', '', 0
where exists (select 1 from glas_objekte where id = 'kzv516')
on conflict (id) do nothing;

-- Bochum: St. Martin / 414
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv591', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Martin / 414', E'Girondelle 92\n44799 Bochum', '3806 591 00', '', '0234 382740', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 591 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv591-p10', 'kzv591', '10', 'Glas- und Rahmenreinigung', '96', '', 0
where exists (select 1 from glas_objekte where id = 'kzv591')
on conflict (id) do nothing;

-- Bochum: St. Paulus / 416
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv517', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Paulus / 416', E'Robert-Koch-Straße 33\n44801 Bochum', '3806 517 00', 'Anja Junker-Vaccaro', '0234 702946', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 517 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv517-p10', 'kzv517', '10', 'Glas- und Rahmenreinigung', '177,54', '', 0
where exists (select 1 from glas_objekte where id = 'kzv517')
on conflict (id) do nothing;

-- Bochum: Liebfrauen / 419
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv518', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Liebfrauen / 419', E'Liebfrauenstraße 11\n44803 Bochum', '3806 518 00', 'Kerstin Rakoschek', '0234 355064', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 518 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv518-p10', 'kzv518', '10', 'Glas- und Rahmenreinigung', '145,81', '', 0
where exists (select 1 from glas_objekte where id = 'kzv518')
on conflict (id) do nothing;

-- Bochum: Fronleichnam / 418
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv592', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Fronleichnam / 418', E'Claus-Groth-Straße 27\n44803 Bochum', '3806 592 00', '', '0234 35963', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 592 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv592-p10', 'kzv592', '10', 'Glas- und Rahmenreinigung', '83,3', '', 0
where exists (select 1 from glas_objekte where id = 'kzv592')
on conflict (id) do nothing;

-- Bochum: Heilig Geist / 420
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv519', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilig Geist / 420', E'Monikastraße 16\n44805 Bochum', '3806 519 00', 'Anna Popella', '0234 234666', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 519 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv519-p10', 'kzv519', '10', 'Glas- und Rahmenreinigung', '62,84', '', 0
where exists (select 1 from glas_objekte where id = 'kzv519')
on conflict (id) do nothing;

-- Bochum: Kindervilla Dreihügel - St. Elisabeth / 422
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv520', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Kindervilla Dreihügel - St. Elisabeth / 422', E'Dreihügelstraße 28\n44805 Bochum', '3806 520 00', 'Annemarie Theis', '0234 862550', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 520 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv520-p10', 'kzv520', '10', 'Glas- und Rahmenreinigung', '80,9', '', 0
where exists (select 1 from glas_objekte where id = 'kzv520')
on conflict (id) do nothing;

-- Bochum: St. Joseph / 425
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv521', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Joseph / 425', E'Im Hagenacker 4\n44805 Bochum', '3806 521 00', 'Gabriele Kühl', '0234 851700', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 521 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv521-p10', 'kzv521', '10', 'Glas- und Rahmenreinigung', '62,9', '', 0
where exists (select 1 from glas_objekte where id = 'kzv521')
on conflict (id) do nothing;

-- Bochum: St. Franziskus / 426
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv522', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Franziskus / 426', E'Auf der Markscheide 34\n44807 Bochum', '3806 522 00', 'Walburga Voglauer', '0234 532190', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 522 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv522-p10', 'kzv522', '10', 'Glas- und Rahmenreinigung', '55,64', '', 0
where exists (select 1 from glas_objekte where id = 'kzv522')
on conflict (id) do nothing;

-- Bochum: St. Liborius / 427
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv523', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Liborius / 427', E'An der Kaiseraue 8\n44807 Bochum', '3806 523 00', 'Mechthild Wilhelmus', '0234 9014791', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 523 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv523-p10', 'kzv523', '10', 'Glas- und Rahmenreinigung', '55,49', '', 0
where exists (select 1 from glas_objekte where id = 'kzv523')
on conflict (id) do nothing;

-- Bochum: Herz Jesu / 428
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv524', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Herz Jesu / 428', E'Dorstener Straße 187 c\n44809 Bochum', '3806 524 00', 'Lucia Musbach', '0234 524854', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 524 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv524-p10', 'kzv524', '10', 'Glas- und Rahmenreinigung', '155,7', '', 0
where exists (select 1 from glas_objekte where id = 'kzv524')
on conflict (id) do nothing;

-- Bochum: St. Nikolaus von Flüe / 431
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv526', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Nikolaus von Flüe / 431', E'Poststraße 198\n44809 Bochum', '3806 526 00', 'Gabriele Mevis', '0234 520534', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 526 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv526-p10', 'kzv526', '10', 'Glas- und Rahmenreinigung', '59,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv526')
on conflict (id) do nothing;

-- Bochum: Herz Mariä / 432
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv527', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Herz Mariä / 432', E'Schmiedestraße 29\n44866 Bochum', '3806 527 00', 'Andrea Schwarz', '02327 23267', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 527 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv527-p10', 'kzv527', '10', 'Glas- und Rahmenreinigung', '105', '', 0
where exists (select 1 from glas_objekte where id = 'kzv527')
on conflict (id) do nothing;

-- Bochum: St. Gertrud / 433
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv528', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Gertrud / 433', E'Gertrudenhof 6\n44866 Bochum', '3806 528 00', 'Dorothea Lewing-Schild', '02327 34459', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 528 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv528-p10', 'kzv528', '10', 'Glas- und Rahmenreinigung', '81,3', '', 0
where exists (select 1 from glas_objekte where id = 'kzv528')
on conflict (id) do nothing;

-- Bochum: St. Johannes / 434
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv529', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Johannes / 434', E'Kemnastraße 14\n44866 Bochum', '3806 529 00', 'Denise Korn', '02327 31037', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 529 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv529-p10', 'kzv529', '10', 'Glas- und Rahmenreinigung', '103,15', '', 0
where exists (select 1 from glas_objekte where id = 'kzv529')
on conflict (id) do nothing;

-- Bochum: St. Joseph / 435
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv530', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Joseph / 435', E'Geitlingstraße 7\n44866 Bochum', '3806 530 00', 'Marianne Widera-Gocke', '02327 89925', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 530 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv530-p10', 'kzv530', '10', 'Glas- und Rahmenreinigung', '74,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv530')
on conflict (id) do nothing;

-- Bochum: St. Swidbert / 437
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv574', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Swidbert / 437', E'Heribertistraße 34\n44866 Bochum', '3806 574 00', 'Gabriele Middendorf', '02327 84214', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 574 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv574-p10', 'kzv574', '10', 'Glas- und Rahmenreinigung', '59,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv574')
on conflict (id) do nothing;

-- Bochum: St. Maria Magdalena / 439
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv532', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Maria Magdalena / 439', E'Vincenzstraße 13\n44869 Bochum', '3806 532 00', 'Stephanie Rösen', '02327 51280', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 532 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv532-p10', 'kzv532', '10', 'Glas- und Rahmenreinigung', '67,1', '', 0
where exists (select 1 from glas_objekte where id = 'kzv532')
on conflict (id) do nothing;

-- Bochum: St. Marien / 440
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv533', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Marien / 440', E'Forstring 4\n44869 Bochum', '3806 533 00', 'Jutta Münnig', '02327 76107', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 533 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv533-p10', 'kzv533', '10', 'Glas- und Rahmenreinigung', '62,15', '', 0
where exists (select 1 from glas_objekte where id = 'kzv533')
on conflict (id) do nothing;

-- Bochum: St. Theresia vom Kinde Jesu / 441
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv534', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Theresia vom Kinde Jesu / 441', E'Holzstraße 12\n44869 Bochum', '3806 534 00', 'Marianne Liebich', '02327 73236', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 534 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv534-p10', 'kzv534', '10', 'Glas- und Rahmenreinigung', '66,3', '', 0
where exists (select 1 from glas_objekte where id = 'kzv534')
on conflict (id) do nothing;

-- Bochum: Liebfrauen / 442
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv535', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Liebfrauen / 442', E'Hattinger Straße 812 a\n44879 Bochum', '3806 535 00', 'Sylvia Liedhegener', '0234 496730', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 535 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv535-p10', 'kzv535', '10', 'Glas- und Rahmenreinigung', '70,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv535')
on conflict (id) do nothing;

-- Bochum: St. Angela / 443
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv536', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Angela / 443', E'Im Ostholz 34\n44879 Bochum', '3806 536 00', 'Birgit Niewierra', '0234 471942', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 536 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv536-p10', 'kzv536', '10', 'Glas- und Rahmenreinigung', '76,6', '', 0
where exists (select 1 from glas_objekte where id = 'kzv536')
on conflict (id) do nothing;

-- Bochum: St. Engelbert / 444
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv537', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Engelbert / 444', E'Hasenwinkelerstraße 167 a\n44879 Bochum', '3806 537 00', 'Susanne Klinker', '0234 496449', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 537 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv537-p10', 'kzv537', '10', 'Glas- und Rahmenreinigung', '61', '', 0
where exists (select 1 from glas_objekte where id = 'kzv537')
on conflict (id) do nothing;

-- Bochum: St. Bonifatius / 3806
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv538', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Bonifatius / 3806', E'Bonifatiusstraße 21 a\n44892 Bochum', '3806 538 00', 'Renate Wolff', '0234 280865', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 538 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv538-p10', 'kzv538', '10', 'Glas- und Rahmenreinigung', '125,4', '', 0
where exists (select 1 from glas_objekte where id = 'kzv538')
on conflict (id) do nothing;

-- Bochum: St. Marien / 449
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv539', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Marien / 449', E'Rüsselsheimer Weg 13\n44892 Bochum', '3806 539 00', 'Monika Borgmann', '0234 289791', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 539 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv539-p10', 'kzv539', '10', 'Glas- und Rahmenreinigung', '96,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv539')
on conflict (id) do nothing;

-- Bochum: Herz Jesu / 450
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv571', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Herz Jesu / 450', E'Hölterweg 2\n44894 Bochum', '3806 571 00', 'Birgit Piekert', '0234 262581', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 571 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv571-p10', 'kzv571', '10', 'Glas- und Rahmenreinigung', '57,09', '', 0
where exists (select 1 from glas_objekte where id = 'kzv571')
on conflict (id) do nothing;

-- Bochum: St. Barbara / 472
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv603', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Barbara / 472', E'Köttlinger Weg\n44793 Bochum', '3806 603 00', '', '0234 61069434', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 603 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv603-p10', 'kzv603', '10', 'Glas- und Rahmenreinigung', '138,6', '', 0
where exists (select 1 from glas_objekte where id = 'kzv603')
on conflict (id) do nothing;

-- Bochum: St. Nikolaus II / 471
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv553', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Nikolaus II / 471', E'Isenbrockstraße 9\n44867 Bochum', '3806 553 00', 'Sabrina Bader', '02327 3034995', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 553 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv553-p10', 'kzv553', '10', 'Glas- und Rahmenreinigung', '125,4', '', 0
where exists (select 1 from glas_objekte where id = 'kzv553')
on conflict (id) do nothing;

-- Gelsenkirchen: Liebfrauen / 500
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv554', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Liebfrauen / 500', E'Ottilienstraße 19\n45879 Gelsenkirchen', '3806 554 00', 'Herr Bogdanski', '0209 208530', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 554 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv554-p10', 'kzv554', '10', 'Glas- und Rahmenreinigung', '124,23', '', 0
where exists (select 1 from glas_objekte where id = 'kzv554')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Agnes / 501
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv555', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Agnes / 501', E'Grillostraße 57 a\n45881 Gelsenkirchen', '3806 555 00', 'Marianne Stegemann', '0209 47866', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 555 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv555-p10', 'kzv555', '10', 'Glas- und Rahmenreinigung', '156,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv555')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Antonius / 503
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv556', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Antonius / 503', E'Am Schillerplatz 12 a\n45883 Gelsenkirchen', '3806 556 00', 'Anja Nadrowski', '0209 44749', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 556 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv556-p10', 'kzv556', '10', 'Glas- und Rahmenreinigung', '85,7', '', 0
where exists (select 1 from glas_objekte where id = 'kzv556')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Elisabeth / 504
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv557', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Elisabeth / 504', E'Holtgrawenstraße 22\n45883 Gelsenkirchen', '3806 557 00', 'Margot Schmidt', '0209 36126592', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 557 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv557-p10', 'kzv557', '10', 'Glas- und Rahmenreinigung', '160,9', '', 0
where exists (select 1 from glas_objekte where id = 'kzv557')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Josef / 506
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv596', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Josef / 506', E'Belforter Straße 12\n45884 Gelsenkirchen', '3806 596 00', '', '0209 12213', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 596 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv596-p10', 'kzv596', '10', 'Glas- und Rahmenreinigung', '85', '', 0
where exists (select 1 from glas_objekte where id = 'kzv596')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Josef / 509
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv558', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Josef / 509', E'Frankfurter Straße 15\n45886 Gelsenkirchen', '3806 558 00', 'Gisela Damann', '0209 201133', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 558 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv558-p10', 'kzv558', '10', 'Glas- und Rahmenreinigung', '99,25', '', 0
where exists (select 1 from glas_objekte where id = 'kzv558')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Thomas Morus / 510
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv559', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Thomas Morus / 510', E'Holtkamp 40\n45886 Gelsenkirchen', '3806 559 00', 'Britta Brückner', '0209 206977', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 559 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv559-p10', 'kzv559', '10', 'Glas- und Rahmenreinigung', '73,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv559')
on conflict (id) do nothing;

-- Gelsenkirchen: Heilige Familie I / 512
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv560', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilige Familie I / 512', E'Im Mühlenfeld 14\n45888 Gelsenkirchen', '3806 560 00', 'Ingrid Raddatz', '0209 200366', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 560 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv560-p10', 'kzv560', '10', 'Glas- und Rahmenreinigung', '61,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv560')
on conflict (id) do nothing;

-- Gelsenkirchen: Heilige Familie II / 513
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv561', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilige Familie II / 513', E'Im Mühlenfeld 12\n45888 Gelsenkirchen', '3806 561 00', 'Ingird Raddatz', '0209 200380', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 561 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv561-p10', 'kzv561', '10', 'Glas- und Rahmenreinigung', '86,16', '', 0
where exists (select 1 from glas_objekte where id = 'kzv561')
on conflict (id) do nothing;

-- Gelsenkirchen: Heilige Dreifaltigkeit / 514
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv597', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilige Dreifaltigkeit / 514', E'Hagemannshof 5\n45889 Gelsenkirchen', '3806 597 00', '', '0209 811737', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 597 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv597-p10', 'kzv597', '10', 'Glas- und Rahmenreinigung', '121,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv597')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Bonifatius / 518
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv562', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Bonifatius / 518', E'Forsthauswinkel 33\n45891 Gelsenkirchen', '3806 562 00', 'Karin Droste', '0209 771309', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 562 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv562-p10', 'kzv562', '10', 'Glas- und Rahmenreinigung', '85,64', '', 0
where exists (select 1 from glas_objekte where id = 'kzv562')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Suitbert / 519
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv563', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Suitbert / 519', E'Spiekermannstraße 16\n45891 Gelsenkirchen', '3806 563 00', 'Dominika Nickel', '0209 784635', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 563 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv563-p10', 'kzv563', '10', 'Glas- und Rahmenreinigung', '109,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv563')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Konrad / 516
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv575', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Konrad / 516', E'Gartmannshof 9\n45891 Gelsenkirchen', '3806 575 00', 'Ursula Hetkämper', '0209 75226', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 575 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv575-p10', 'kzv575', '10', 'Glas- und Rahmenreinigung', '40,68', '', 0
where exists (select 1 from glas_objekte where id = 'kzv575')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Barbara / 517
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv598', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Barbara / 517', E'Friedenstraße 16 b\n45891 Gelsenkirchen', '3806 598 00', 'Koch', '0209 72886', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 598 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv598-p10', 'kzv598', '10', 'Glas- und Rahmenreinigung', '125,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv598')
on conflict (id) do nothing;

-- Gelsenkirchen: Herz Jesu I Resse / 520
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv599', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Herz Jesu I Resse / 520', E'Ahornstraße 50\n45892 Gelsenkirchen', '3806 599 00', '', '0209 72498', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 599 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv599-p10', 'kzv599', '10', 'Glas- und Rahmenreinigung', '85', '', 0
where exists (select 1 from glas_objekte where id = 'kzv599')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Urbanus I / 523
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv600', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Urbanus I / 523', E'Buer-Gladbecker-Straße 14\n45894 Gelsenkirchen', '3806 600 00', '', '0209 379546', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 600 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv600-p10', 'kzv600', '10', 'Glas- und Rahmenreinigung', '98', '', 0
where exists (select 1 from glas_objekte where id = 'kzv600')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Mariä Himmelfahrt / 524
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv601', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Mariä Himmelfahrt / 524', E'Goldbergstraße 11\n45894 Gelsenkirchen', '3806 601 00', '', '0209 32695', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 601 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv601-p10', 'kzv601', '10', 'Glas- und Rahmenreinigung', '155,67', '', 0
where exists (select 1 from glas_objekte where id = 'kzv601')
on conflict (id) do nothing;

-- Gelsenkirchen: Don Bosco / 525
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv564', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Don Bosco / 525', E'Feldhauser Straße 208 a\n45896 Gelsenkirchen', '3806 564 00', 'Margrit Tielmann', '0209 395024', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 564 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv564-p10', 'kzv564', '10', 'Glas- und Rahmenreinigung', '104', '', 0
where exists (select 1 from glas_objekte where id = 'kzv564')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Michael / 502
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv580', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Michael / 502', E'St. Michael Str. 2\n45896 Gelsenkirchen', '3806 580 00', '', '0209 60446790', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 580 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv580-p10', 'kzv580', '10', 'Glas- und Rahmenreinigung', '245,3', '', 0
where exists (select 1 from glas_objekte where id = 'kzv580')
on conflict (id) do nothing;

-- Gelsenkirchen: Heilig Geist - St. Ludgerus II / 528
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv566', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilig Geist - St. Ludgerus II / 528', E'Giebelstraße 14\n45897 Gelsenkirchen', '3806 566 00', 'Doris Kreutz', '0209 597450', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 566 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv566-p10', 'kzv566', '10', 'Glas- und Rahmenreinigung', '85,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv566')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Ludgerus I / 530
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv567', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Ludgerus I / 530', E'Ludgeristraße 9\n45897 Gelsenkirchen', '3806 567 00', 'Birgit Hilmer', '0209 598461', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 567 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv567-p10', 'kzv567', '10', 'Glas- und Rahmenreinigung', '81,3', '', 0
where exists (select 1 from glas_objekte where id = 'kzv567')
on conflict (id) do nothing;

-- Gelsenkirchen: Liebfrauen II / 532
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv568', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Liebfrauen II / 532', E'Rosenstraße 59\n45899 Gelsenkirchen', '3806 568 00', 'Susanne Hülsken', '0209 584218', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 568 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv568-p10', 'kzv568', '10', 'Glas- und Rahmenreinigung', '61,1', '', 0
where exists (select 1 from glas_objekte where id = 'kzv568')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Hippolytus / 533
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv569', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Hippolytus / 533', E'Auf dem Schollbruch 51\n45899 Gelsenkirchen', '3806 569 00', 'Susanne Hülsken', '0209 56869', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 569 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv569-p10', 'kzv569', '10', 'Glas- und Rahmenreinigung', '77', '', 0
where exists (select 1 from glas_objekte where id = 'kzv569')
on conflict (id) do nothing;

-- Gelsenkirchen: St. Laurentius I / 535
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv570', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Laurentius I / 535', E'Zum Bauverein 34\n45899 Gelsenkirchen', '3806 570 00', 'Sabine Müller-Führer', '0209 52794', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 570 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv570-p10', 'kzv570', '10', 'Glas- und Rahmenreinigung', '57,7', '', 0
where exists (select 1 from glas_objekte where id = 'kzv570')
on conflict (id) do nothing;

-- Gelsenkirchen: Kita St.Barbara / 505
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv595', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Kita St.Barbara / 505', E'Danzingerstraße 25\n45884 Gelsenkirchen', '3806 595 00', '', '0209 12747', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 595 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv595-p10', 'kzv595', '10', 'Glas- und Rahmenreinigung', '', '', 0
where exists (select 1 from glas_objekte where id = 'kzv595')
on conflict (id) do nothing;

-- Hattingen: St. Christophorus / 451
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv540', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Christophorus / 451', E'Bahnhofstraße 23 a\n45525 Hattingen', '3806 540 00', 'Susanne Sobotta', '02324 25949', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 540 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv540-p10', 'kzv540', '10', 'Glas- und Rahmenreinigung', '143,25', '', 0
where exists (select 1 from glas_objekte where id = 'kzv540')
on conflict (id) do nothing;

-- Hattingen: St. Josef / 452
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv541', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Josef / 452', E'Thingstraße 39\n45527 Hattingen', '3806 541 00', 'Susanne Kather', '02324 61199', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 541 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv541-p10', 'kzv541', '10', 'Glas- und Rahmenreinigung', '99,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv541')
on conflict (id) do nothing;

-- Hattingen: St. Peter und Paul / 453
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv542', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Peter und Paul / 453', E'Albertweg 12\n45527 Hattingen', '3806 542 00', 'Marion Buchhorn', '02324 30769', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 542 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv542-p10', 'kzv542', '10', 'Glas- und Rahmenreinigung', '170,59', '', 0
where exists (select 1 from glas_objekte where id = 'kzv542')
on conflict (id) do nothing;

-- Hattingen: Heilig Geist / 454
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv543', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilig Geist / 454', E'Denkmalstraße 26\n45529 Hattingen', '3806 543 00', 'Petra Karopka', '02324 80927', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 543 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv543-p10', 'kzv543', '10', 'Glas- und Rahmenreinigung', '90', '', 0
where exists (select 1 from glas_objekte where id = 'kzv543')
on conflict (id) do nothing;

-- Hattingen: St. Mauritius / 455
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv544', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Mauritius / 455', E'Essener Straße 30 a\n45529 Hattingen', '3806 544 00', 'Susanne Kriege', '02324 40671', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 544 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv544-p10', 'kzv544', '10', 'Glas- und Rahmenreinigung', '165,06', '', 0
where exists (select 1 from glas_objekte where id = 'kzv544')
on conflict (id) do nothing;

-- Lüdenscheid: St. Rita / 335
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv501', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Rita / 335', E'Graf-Von-Galen-Straße 23\n58509 Lüdenscheid', '3806 501 00', 'Marina Hesse', '02351 27180', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 501 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv501-p10', 'kzv501', '10', 'Glas- und Rahmenreinigung', '104,25', '', 0
where exists (select 1 from glas_objekte where id = 'kzv501')
on conflict (id) do nothing;

-- Lüdenscheid: Pater Anton Bertsche / 331
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv581', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Pater Anton Bertsche / 331', E'Im Olpendahl 2 b\n58507 Lüdenscheid', '3806 581 00', '', '02351 53550', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 581 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv581-p10', 'kzv581', '10', 'Glas- und Rahmenreinigung', '75,7', '', 0
where exists (select 1 from glas_objekte where id = 'kzv581')
on conflict (id) do nothing;

-- Lüdenscheid: St. Joseph / 334
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv582', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Joseph / 334', E'Am Ramsberg 112\n58509 Lüdenscheid', '3806 582 00', '', '02351 21860', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 582 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv582-p10', 'kzv582', '10', 'Glas- und Rahmenreinigung', '166,5', '', 0
where exists (select 1 from glas_objekte where id = 'kzv582')
on conflict (id) do nothing;

-- Lüdenscheid: St. Petrus und Paulus / 336
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv583', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Petrus und Paulus / 336', E'Berliner Straße 18\n58511 Lüdenscheid', '3806 583 00', '', '02351 81141', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 583 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv583-p10', 'kzv583', '10', 'Glas- und Rahmenreinigung', '155,7', '', 0
where exists (select 1 from glas_objekte where id = 'kzv583')
on conflict (id) do nothing;

-- Lüdenscheid: Die Arche / 337
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv584', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Die Arche / 337', E'Kalver Straße 2 a\n58515 Lüdenscheid', '3806 584 00', '', '02351 458666', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 584 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv584-p10', 'kzv584', '10', 'Glas- und Rahmenreinigung', '121,55', '', 0
where exists (select 1 from glas_objekte where id = 'kzv584')
on conflict (id) do nothing;

-- Divers: St. Martin / 340
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv503', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Martin / 340', E'Birkeshöhstraße 39 b\n58540 Meinerzhagen', '3806 503 00', 'Marlies Fernholz', '02354 2276', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 503 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv503-p10', 'kzv503', '10', 'Glas- und Rahmenreinigung', '112,14', '', 0
where exists (select 1 from glas_objekte where id = 'kzv503')
on conflict (id) do nothing;

-- Divers: St. Nikolaus / 342
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv504', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Nikolaus / 342', E'Bachstraße 16\n58553 Halver', '3806 504 00', 'Petra Dörenbach', '02353 903737', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 504 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv504-p10', 'kzv504', '10', 'Glas- und Rahmenreinigung', '120', '', 0
where exists (select 1 from glas_objekte where id = 'kzv504')
on conflict (id) do nothing;

-- Divers: St. Josef / 343
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv505', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Josef / 343', E'Glockenweg 8\n58566 Kierspe', '3806 505 00', 'Eveline Kraft', '02359 3421', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 505 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv505-p10', 'kzv505', '10', 'Glas- und Rahmenreinigung', '96,1', '', 0
where exists (select 1 from glas_objekte where id = 'kzv505')
on conflict (id) do nothing;

-- Divers: St. Elisabeth / 347
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv506', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Elisabeth / 347', E'Hagener Straße 1\n58769 Nachrodt', '3806 506 00', 'Sandra Schwieren', '02352 30042', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 506 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv506-p10', 'kzv506', '10', 'Glas- und Rahmenreinigung', '68,02', '', 0
where exists (select 1 from glas_objekte where id = 'kzv506')
on conflict (id) do nothing;

-- Divers: St. Bonifatius / 348
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv507', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Bonifatius / 348', E'Kirchstraße 3\n58791 Werdohl', '3806 507 00', 'Helma Neuberger', '02392 70557', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 507 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv507-p10', 'kzv507', '10', 'Glas- und Rahmenreinigung', '125,43', '', 0
where exists (select 1 from glas_objekte where id = 'kzv507')
on conflict (id) do nothing;

-- Divers: Unterm Regenbogen / 352
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv508', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Unterm Regenbogen / 352', E'Am Semberg 6\n58809 Neuenrade', '3806 508 00', 'Sabrina Maas', '02392 62230', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 508 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv508-p10', 'kzv508', '10', 'Glas- und Rahmenreinigung', '125,5', '', 0
where exists (select 1 from glas_objekte where id = 'kzv508')
on conflict (id) do nothing;

-- Divers: St. Johannes Baptist I / 353
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv509', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Johannes Baptist I / 353', E'Karlstraße 18\n58840 Plettenberg', '3806 509 00', 'Iris Diedenhofen', '02391 52062', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 509 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv509-p10', 'kzv509', '10', 'Glas- und Rahmenreinigung', '84,49', '', 0
where exists (select 1 from glas_objekte where id = 'kzv509')
on conflict (id) do nothing;

-- Divers: St. Laurentius / 354
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv510', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Laurentius / 354', E'Lehmkuhler Straße 10\n58840 Plettenberg', '3806 510 00', 'Karin Florath', '02391 10562', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 510 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv510-p10', 'kzv510', '10', 'Glas- und Rahmenreinigung', '205,64', '', 0
where exists (select 1 from glas_objekte where id = 'kzv510')
on conflict (id) do nothing;

-- Divers: St. Josef / 457
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv545', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Josef / 457', E'Kortenstraße 4\n45549 Sprockhövel', '3806 545 00', 'Ursula Papenkort', '02339 4771', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 545 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv545-p10', 'kzv545', '10', 'Glas- und Rahmenreinigung', '133,7', '', 0
where exists (select 1 from glas_objekte where id = 'kzv545')
on conflict (id) do nothing;

-- Divers: St. Johann Baptist - Morgenland / 459
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv546', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Johann Baptist - Morgenland / 459', E'Milsper Straße 32\n58256 Ennepetal', '3806 546 00', 'Katja Heumann', '02333 4350', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 546 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv546-p10', 'kzv546', '10', 'Glas- und Rahmenreinigung', '98,09', '', 0
where exists (select 1 from glas_objekte where id = 'kzv546')
on conflict (id) do nothing;

-- Divers: St. Martin / 460
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv547', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Martin / 460', E'Büttenberger Straße 30\n58256 Ennepetal', '3806 547 00', 'Andrea Grafe', '02333 70099', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 547 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv547-p10', 'kzv547', '10', 'Glas- und Rahmenreinigung', '85,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv547')
on conflict (id) do nothing;

-- Divers: Liebfrauen / 461
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv548', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Liebfrauen / 461', E'Märkische Straße 45\n58285 Gevelsberg', '3806 548 00', 'Martina Knorr', '02332 60144', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 548 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv548-p10', 'kzv548', '10', 'Glas- und Rahmenreinigung', '214,74', '', 0
where exists (select 1 from glas_objekte where id = 'kzv548')
on conflict (id) do nothing;

-- Divers: St. Engelbert / 462
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv549', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Engelbert / 462', E'Rosendahler Straße 8\n58285 Gevelsberg', '3806 549 00', 'Marion Mariniak', '02332 4271', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 549 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv549-p10', 'kzv549', '10', 'Glas- und Rahmenreinigung', '70,6', '', 0
where exists (select 1 from glas_objekte where id = 'kzv549')
on conflict (id) do nothing;

-- Divers: St. Gerwin / 463
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv550', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Gerwin / 463', E'An der Windecke 21\n58300 Wetter', '3806 550 00', 'Anna-Lena Suriel-Vasquez', '02335 61010', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 550 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv550-p10', 'kzv550', '10', 'Glas- und Rahmenreinigung', '57,4', '', 0
where exists (select 1 from glas_objekte where id = 'kzv550')
on conflict (id) do nothing;

-- Divers: St. Jakobus / 466
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv551', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Jakobus / 466', E'Pastor-Hellweg-Straße 12\n58339 Breckerfeld', '3806 551 00', 'Andrea Müller', '02338 8301', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 551 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv551-p10', 'kzv551', '10', 'Glas- und Rahmenreinigung', '44,2', '', 0
where exists (select 1 from glas_objekte where id = 'kzv551')
on conflict (id) do nothing;

-- Divers: St. Barbara / 467
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv552', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Barbara / 467', E'Wittener Straße 51\n58456 Witten', '3806 552 00', 'Claudia Elsche', '02302 73766', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 552 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv552-p10', 'kzv552', '10', 'Glas- und Rahmenreinigung', '104,32', '', 0
where exists (select 1 from glas_objekte where id = 'kzv552')
on conflict (id) do nothing;

-- Divers: Heilig Geist / 464
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv572', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'Heilig Geist / 464', E'Sedanstraße 18\n58332 Schwelm', '3806 572 00', 'Sabine Guleja-Wentowski', '02336 6826', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 572 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv572-p10', 'kzv572', '10', 'Glas- und Rahmenreinigung', '92,9', '', 0
where exists (select 1 from glas_objekte where id = 'kzv572')
on conflict (id) do nothing;

-- Divers: St. Matthäus / 345
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv577', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Matthäus / 345', E'Lindenstraße 37\n58762 Altena', '3806 577 00', '', '02352 23338', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 577 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv577-p10', 'kzv577', '10', 'Glas- und Rahmenreinigung', '74,84', '', 0
where exists (select 1 from glas_objekte where id = 'kzv577')
on conflict (id) do nothing;

-- Divers: St. Januarius / 456
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv578', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Januarius / 456', E'Von-Galen-Straße 7\n45549 Sprockhövel', '3806 578 00', '', '02324 78225', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 578 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv578-p10', 'kzv578', '10', 'Glas- und Rahmenreinigung', '65,8', '', 0
where exists (select 1 from glas_objekte where id = 'kzv578')
on conflict (id) do nothing;

-- Divers: St. Katharina / 344
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv586', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Katharina / 344', E'Finkenweg 57\n58762 Altena', '3806 586 00', '', '02352 50658', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 586 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv586-p10', 'kzv586', '10', 'Glas- und Rahmenreinigung', '95,67', '', 0
where exists (select 1 from glas_objekte where id = 'kzv586')
on conflict (id) do nothing;

-- Divers: St. Michael / 350
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv587', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Michael / 350', E'Brüderstraße 2\n58791 Werdohl', '3806 587 00', '', '02392 10460', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 587 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv587-p10', 'kzv587', '10', 'Glas- und Rahmenreinigung', '69', '', 0
where exists (select 1 from glas_objekte where id = 'kzv587')
on conflict (id) do nothing;

-- Divers: St. Marien / 465
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'kzv594', (select id from kunden where name ilike '%zweckverband%' limit 1), (select name from kunden where name ilike '%zweckverband%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%zweckverband%' limit 1), 'St. Marien / 465', E'Marienweg 5\n58332 Schwelm', '3806 594 00', '', '02336 10242', 'sub', null, null
where not exists (select 1 from glas_objekte where kdnr = '3806 594 00')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, reihenfolge)
select 'kzv594-p10', 'kzv594', '10', 'Glas- und Rahmenreinigung', '111,11', '', 0
where exists (select 1 from glas_objekte where id = 'kzv594')
on conflict (id) do nothing;
