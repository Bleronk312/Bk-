-- Test-Daten für die Glasreinigung: 10 Kunden mit insgesamt ~25 Objekten und
-- unterschiedlichsten Intervallen, damit man Kalender/Offene Liste/Objekt-Seiten
-- mit realistischen Daten sehen kann.
--
-- Gefahrlos mehrfach ausführbar (on conflict do nothing) und komplett wieder
-- entfernbar über das Lösch-Skript ganz unten (auskommentiert).
--
-- In Supabase SQL Editor einfügen -> Run.

-- ================== Kunden (geteilte Tabelle mit der normalen Abnahme-App) ==================
insert into kunden (id, name, adresse, kdnr) values
  ('seed_k1', 'Zweckverband Kath. Tageseinrichtungen Bochum', E'Im Kirchfeld 3\n44787 Bochum', '3806 100 00'),
  ('seed_k2', 'AWO Kreisverband Bochum', E'Universitätsstraße 12\n44789 Bochum', '3806 200 00'),
  ('seed_k3', 'Diakonie Bochum', E'Westring 32\n44787 Bochum', '3806 300 00'),
  ('seed_k4', 'Deutsches Rotes Kreuz Bochum', E'Alleestraße 80\n44793 Bochum', '3806 400 00'),
  ('seed_k5', 'Caritasverband Bochum', E'Brückstraße 68\n44787 Bochum', '3806 500 00'),
  ('seed_k6', 'Stadt Bochum - Amt für Kinder', E'Willy-Brandt-Platz 2-6\n44787 Bochum', '3806 600 00'),
  ('seed_k7', 'Familienzentrum Bochum-Wattenscheid', E'Am Alten Amt 5\n44866 Bochum', '3806 700 00'),
  ('seed_k8', 'Kindergarten St. Elisabeth e.V.', E'Königsallee 24\n44789 Bochum', '3806 800 00'),
  ('seed_k9', 'Ev. Kirchengemeinde Bochum', E'Massenbergstraße 15\n44787 Bochum', '3806 900 00'),
  ('seed_k10', 'PariSozial Bochum GmbH', E'Josephinenstraße 5\n44793 Bochum', '3807 000 00')
on conflict (id) do nothing;

-- ================== Objekte ==================
-- lat/lng sind grobe, aber echte Bochumer Koordinaten (unterschiedliche Stadtteile),
-- damit die Routenoptimierung im Kalender/bei Touren direkt sinnvoll sortieren kann.
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, lat, lng) values
  ('seed_o1', 'seed_k1', 'Zweckverband Kath. Tageseinrichtungen Bochum', E'Zweckverband Kath. Tageseinrichtungen Bochum\nIm Kirchfeld 3\n44787 Bochum', 'Kita St. Anna / 407', E'Bleichstraße 10\n44787 Bochum', '3806 101 00', 51.4826, 7.2158),
  ('seed_o2', 'seed_k1', 'Zweckverband Kath. Tageseinrichtungen Bochum', E'Zweckverband Kath. Tageseinrichtungen Bochum\nIm Kirchfeld 3\n44787 Bochum', 'Kita St. Josef / 412', E'Stühmeyerstraße 45\n44787 Bochum', '3806 102 00', 51.4816, 7.2144),
  ('seed_o3', 'seed_k1', 'Zweckverband Kath. Tageseinrichtungen Bochum', E'Zweckverband Kath. Tageseinrichtungen Bochum\nIm Kirchfeld 3\n44787 Bochum', 'Kita St. Marien / 418', E'Düppelstraße 49\n44789 Bochum', '3806 103 00', 51.4885, 7.2262),

  ('seed_o4', 'seed_k2', 'AWO Kreisverband Bochum', E'AWO Kreisverband Bochum\nUniversitätsstraße 12\n44789 Bochum', 'AWO Kita Regenbogen', E'Castroper Straße 237\n44791 Bochum', '3806 201 00', 51.4903, 7.2410),
  ('seed_o5', 'seed_k2', 'AWO Kreisverband Bochum', E'AWO Kreisverband Bochum\nUniversitätsstraße 12\n44789 Bochum', 'AWO Kita Sonnenschein', E'Goldhammer Straße 14\n44793 Bochum', '3806 202 00', 51.4649, 7.1932),

  ('seed_o6', 'seed_k3', 'Diakonie Bochum', E'Diakonie Bochum\nWestring 32\n44787 Bochum', 'Familienzentrum Diakonie Mitte', E'Westring 40\n44787 Bochum', '3806 301 00', 51.4834, 7.2100),
  ('seed_o7', 'seed_k3', 'Diakonie Bochum', E'Diakonie Bochum\nWestring 32\n44787 Bochum', 'Kita Diakonie Ost', E'Alte Wittener Straße 5\n44803 Bochum', '3806 302 00', 51.4707, 7.2536),
  ('seed_o8', 'seed_k3', 'Diakonie Bochum', E'Diakonie Bochum\nWestring 32\n44787 Bochum', 'Kita Diakonie Süd', E'Hattinger Straße 430\n44795 Bochum', '3806 303 00', 51.4508, 7.1979),

  ('seed_o9', 'seed_k4', 'Deutsches Rotes Kreuz Bochum', E'Deutsches Rotes Kreuz Bochum\nAlleestraße 80\n44793 Bochum', 'DRK Kita Alleestraße', E'Alleestraße 82\n44793 Bochum', '3806 401 00', 51.4660, 7.1948),
  ('seed_o10', 'seed_k4', 'Deutsches Rotes Kreuz Bochum', E'Deutsches Rotes Kreuz Bochum\nAlleestraße 80\n44793 Bochum', 'DRK Kita Langendreer', E'Alte Bahnhofstraße 8\n44892 Bochum', '3806 402 00', 51.4783, 7.3155),

  ('seed_o11', 'seed_k5', 'Caritasverband Bochum', E'Caritasverband Bochum\nBrückstraße 68\n44787 Bochum', 'Caritas Kita Brückstraße', E'Brückstraße 70\n44787 Bochum', '3806 501 00', 51.4820, 7.2185),
  ('seed_o12', 'seed_k5', 'Caritasverband Bochum', E'Caritasverband Bochum\nBrückstraße 68\n44787 Bochum', 'Caritas Kita Weitmar', E'Hattinger Straße 245\n44795 Bochum', '3806 502 00', 51.4560, 7.1955),

  ('seed_o13', 'seed_k6', 'Stadt Bochum - Amt für Kinder', E'Stadt Bochum - Amt für Kinder\nWilly-Brandt-Platz 2-6\n44787 Bochum', 'Städt. Kita Rathaus', E'Willy-Brandt-Platz 10\n44787 Bochum', '3806 601 00', 51.4813, 7.2163),
  ('seed_o14', 'seed_k6', 'Stadt Bochum - Amt für Kinder', E'Stadt Bochum - Amt für Kinder\nWilly-Brandt-Platz 2-6\n44787 Bochum', 'Städt. Kita Querenburg', E'Universitätsstraße 100\n44801 Bochum', '3806 602 00', 51.4478, 7.2632),
  ('seed_o15', 'seed_k6', 'Stadt Bochum - Amt für Kinder', E'Stadt Bochum - Amt für Kinder\nWilly-Brandt-Platz 2-6\n44787 Bochum', 'Städt. Kita Gerthe', E'Werner Hellweg 400\n44894 Bochum', '3806 603 00', 51.5115, 7.2778),

  ('seed_o16', 'seed_k7', 'Familienzentrum Bochum-Wattenscheid', E'Familienzentrum Bochum-Wattenscheid\nAm Alten Amt 5\n44866 Bochum', 'Familienzentrum Wattenscheid Mitte', E'Am Alten Amt 8\n44866 Bochum', '3806 701 00', 51.4759, 7.1258),
  ('seed_o17', 'seed_k7', 'Familienzentrum Bochum-Wattenscheid', E'Familienzentrum Bochum-Wattenscheid\nAm Alten Amt 5\n44866 Bochum', 'Familienzentrum Höntrop', E'Höntroper Straße 20\n44867 Bochum', '3806 702 00', 51.4620, 7.1041),

  ('seed_o18', 'seed_k8', 'Kindergarten St. Elisabeth e.V.', E'Kindergarten St. Elisabeth e.V.\nKönigsallee 24\n44789 Bochum', 'Kindergarten St. Elisabeth', E'Königsallee 26\n44789 Bochum', '3806 801 00', 51.4870, 7.2233),

  ('seed_o19', 'seed_k9', 'Ev. Kirchengemeinde Bochum', E'Ev. Kirchengemeinde Bochum\nMassenbergstraße 15\n44787 Bochum', 'Ev. Kita Christuskirche', E'Massenbergstraße 20\n44787 Bochum', '3806 901 00', 51.4841, 7.2177),
  ('seed_o20', 'seed_k9', 'Ev. Kirchengemeinde Bochum', E'Ev. Kirchengemeinde Bochum\nMassenbergstraße 15\n44787 Bochum', 'Ev. Kita Lutherkirche', E'Große Beckstraße 12\n44787 Bochum', '3806 902 00', null, null),

  ('seed_o21', 'seed_k10', 'PariSozial Bochum GmbH', E'PariSozial Bochum GmbH\nJosephinenstraße 5\n44793 Bochum', 'PariSozial Kita Ehrenfeld', E'Josephinenstraße 20\n44793 Bochum', '3807 001 00', 51.4635, 7.1897),
  ('seed_o22', 'seed_k10', 'PariSozial Bochum GmbH', E'PariSozial Bochum GmbH\nJosephinenstraße 5\n44793 Bochum', 'PariSozial Kita Linden', E'Lindener Straße 15\n44879 Bochum', '3807 002 00', 51.4396, 7.1622)
on conflict (id) do nothing;

-- ================== Positionen je Objekt (unterschiedlichste Intervalle) ==================
-- Absichtlich eine breite Mischung, damit man sofort alle Zustände sieht:
--  - rollierend, überfällig
--  - rollierend, bald fällig (< 14 Tage)
--  - rollierend, noch länger hin
--  - feste Monate, aktueller Monat (wirkt "überfällig", da auf den 1. gerundet)
--  - feste Monate, erst in ein paar Monaten
--  - zwei Positionen am selben Objekt mit UNTERSCHIEDLICHEM Intervall (Glas + Hubsteiger)
--  - kein Intervall (rein manuell, taucht nirgends in der Fällig-Liste auf)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, intervall_wochen, feste_monate, letzte_reinigung) values
  ('seed_p1',  'seed_o1',  '10', 'Glas- und Rahmenreinigung', '210',   'rollierend',    8, '',        '2026-04-15'), -- überfällig
  ('seed_p2',  'seed_o2',  '10', 'Glas- und Rahmenreinigung', '180',   'rollierend',   12, '',        '2026-06-20'), -- bald fällig
  ('seed_p3',  'seed_o3',  '10', 'Glas- und Rahmenreinigung', '260',   'rollierend',    6, '',        '2026-06-28'), -- geplant, etwas später

  ('seed_p4',  'seed_o4',  '10', 'Glas- und Rahmenreinigung', '150',   'feste_monate', null, '3,6,9,12', '2026-03-05'), -- überfällig (fest Juni war)
  ('seed_p5',  'seed_o5',  '10', 'Glas- und Rahmenreinigung', '190',   'feste_monate', null, '7,12',     null), -- aktueller Monat, wirkt überfällig

  ('seed_p6',  'seed_o6',  '10', 'Glas- und Rahmenreinigung', '320',   'rollierend',   10, '',        '2026-05-01'),
  ('seed_p7',  'seed_o6',  '15', 'Hubsteigereinsatz',         '',      'rollierend',   52, '',        '2026-01-15'), -- gleiches Objekt, ganz anderes Intervall
  ('seed_p8',  'seed_o7',  '10', 'Glas- und Rahmenreinigung', '140',   'rollierend',    8, '',        '2026-06-10'),
  ('seed_p9',  'seed_o8',  '10', 'Glas- und Rahmenreinigung', '175',   'feste_monate', null, '4,10',     '2026-04-02'),

  ('seed_p10', 'seed_o9',  '10', 'Glas- und Rahmenreinigung', '95',    'rollierend',    4, '',        '2026-06-25'), -- bald fällig
  ('seed_p11', 'seed_o10', '10', 'Glas- und Rahmenreinigung', '230',   '',              null, '',      null), -- kein Intervall, rein manuell

  ('seed_p12', 'seed_o11', '10', 'Glas- und Rahmenreinigung', '160',   'rollierend',   16, '',        '2026-03-20'), -- überfällig
  ('seed_p13', 'seed_o12', '10', 'Glas- und Rahmenreinigung', '205',   'rollierend',    8, '',        '2026-06-01'),

  ('seed_p14', 'seed_o13', '10', 'Glas- und Rahmenreinigung', '410',   'rollierend',   12, '',        '2026-04-10'), -- überfällig
  ('seed_p15', 'seed_o13', '20', 'Grundreinigung',            '410',   'feste_monate', null, '1,7',      '2026-01-08'),
  ('seed_p16', 'seed_o14', '10', 'Glas- und Rahmenreinigung', '250',   'rollierend',    8, '',        '2026-06-15'),
  ('seed_p17', 'seed_o15', '10', 'Glas- und Rahmenreinigung', '190',   '',              null, '',      null), -- kein Intervall

  ('seed_p18', 'seed_o16', '10', 'Glas- und Rahmenreinigung', '130',   'rollierend',    6, '',        '2026-06-22'),
  ('seed_p19', 'seed_o17', '10', 'Glas- und Rahmenreinigung', '145',   'rollierend',   26, '',        '2026-02-01'), -- überfällig, halbjährlich

  ('seed_p20', 'seed_o18', '10', 'Glas- und Rahmenreinigung', '90',    'feste_monate', null, '5,11',     '2026-05-03'),

  ('seed_p21', 'seed_o19', '10', 'Glas- und Rahmenreinigung', '110',   'rollierend',    8, '',        '2026-06-05'), -- bald fällig
  ('seed_p22', 'seed_o20', '10', 'Glas- und Rahmenreinigung', '100',   'rollierend',    8, '',        null), -- noch nie gereinigt -> sofort fällig, Objekt ohne Koordinaten

  ('seed_p23', 'seed_o21', '10', 'Glas- und Rahmenreinigung', '165',   'rollierend',   10, '',        '2026-06-18'),
  ('seed_p24', 'seed_o22', '10', 'Glas- und Rahmenreinigung', '200',   '',              null, '',      null) -- kein Intervall
on conflict (id) do nothing;

-- ================== Zum Entfernen der Test-Daten (bei Bedarf auskommentieren und ausführen) ==================
-- delete from glas_objekt_positionen where id like 'seed_p%';
-- delete from glas_objekte where id like 'seed_o%';
-- delete from kunden where id like 'seed_k%';
