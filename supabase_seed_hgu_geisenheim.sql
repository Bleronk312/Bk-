-- Hochschule Geisenheim University (Glasreinigung): Kunde + 1 Objekt (Campus)
-- aus dem Leistungsverzeichnis HGU 2026-04-10_2 (Fensterreinigung).
-- EIN Objekt mit drei Positionen:
--   Pos. 1  Glas- und Rahmenreinigung  - alle 28 Normalpositionen (N, m2) summiert
--           = 9279 m2, Intervall 2x jaehrlich feste Monate April + September (4,9)
--           (Monate vorlaeufig - genauer Zeitpunkt wird noch nachgetragen).
--   Pos. 2  Reinwasserreinigung  - Bedarfsposition (B), OHNE Intervall -> wird manuell
--           ausgewaehlt, taucht nicht automatisch in Faellig-Listen auf.
--   Pos. 3  Bereitstellung Hubsteiger/Scherenarbeitsbuehne - Bedarfsposition (B),
--           OHNE Intervall, manuell.
-- Kd.-Nr. nicht angegeben (bleibt leer). Vorlage: geko.
-- Koordinaten werden beim naechsten Oeffnen der Admin-Seite automatisch ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-hgu-geisenheim', 'Hochschule Geisenheim University', E'Von-Lade-Str. 1\n65366 Geisenheim', '', 'glas'
where not exists (select 1 from kunden where name ilike '%geisenheim%');

-- Objekt (Campus)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hgu1',
  (select id from kunden where name ilike '%geisenheim%' limit 1),
  (select name from kunden where name ilike '%geisenheim%' limit 1),
  (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%geisenheim%' limit 1),
  'Hochschule Geisenheim University', E'Von-Lade-Str. 1\n65366 Geisenheim', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'hgu1')
  and exists (select 1 from kunden where name ilike '%geisenheim%')
on conflict (id) do nothing;

-- Pos. 1: Glas- und Rahmenreinigung (alle Normalpositionen summiert), Intervall 4,9
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hgu1-p1', 'hgu1', '1', 'Glas- und Rahmenreinigung', '9279', 'feste_monate', '4,9', 0
where exists (select 1 from glas_objekte where id = 'hgu1') on conflict (id) do nothing;

-- Pos. 2: Reinwasserreinigung (Bedarfsposition, ohne Intervall, manuell)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hgu1-p2', 'hgu1', '2', 'Reinwasserreinigung', '', '', '', 1
where exists (select 1 from glas_objekte where id = 'hgu1') on conflict (id) do nothing;

-- Pos. 3: Bereitstellung Hubsteiger/Scherenarbeitsbuehne (Bedarfsposition, ohne Intervall, manuell)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hgu1-p3', 'hgu1', '3', 'Bereitstellung Hubsteiger/Scherenarbeitsbühne', '', '', '', 2
where exists (select 1 from glas_objekte where id = 'hgu1') on conflict (id) do nothing;
