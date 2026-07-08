-- Hessisches Competence Center - Delivery Center Beschaffungen (Glasreinigung).
-- Hauptkunde = HCC (Mainzer Straße 75, 65189 Wiesbaden), keine Kd.-Nr.
-- EIN Objekt: Hessisches Ministerium des Innern, fuer Sicherheit und Heimatschutz
--   (Friedrich-Ebert-Allee 12, 65185 Wiesbaden). Quelle: Preisverzeichnis 121-124
--   (Anlagen 1.2.1 - 1.2.4). Zwei Reinigungen pro Jahr, je Leistung eine Position:
--     Pos. 1  Glas- und Rahmenreinigung  April (feste_monate '4')
--             qm = Anlage 1.2.1 (Aussen, 4686,40) + 1.2.2 (Innen, 540,94) = 5227,34
--     Pos. 4  Glasreinigung (nur Glas)   September (feste_monate '9')
--             qm = Anlage 1.2.3 (Aussen, 4686,40) + 1.2.4 (Innen, 540,94) = 5227,34
--   (Die Pauschal-Zeile 'Hoehenzugangstechnik' ist keine Flaeche und wurde nicht mitgezaehlt.)
-- Vorlage: geko. Koordinaten werden beim naechsten Oeffnen der Admin-Seite ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Kunde (Hauptkunde) anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-hcc-wiesbaden', 'Hessisches Competence Center - Delivery Center Beschaffungen', E'Mainzer Straße 75\n65189 Wiesbaden', '', 'glas'
where not exists (select 1 from kunden where name ilike '%competence center%');

-- Objekt: Hessisches Ministerium des Innern (Friedrich-Ebert-Allee 12)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hmdis1',
  (select id from kunden where name ilike '%competence center%' limit 1),
  (select name from kunden where name ilike '%competence center%' limit 1),
  (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%competence center%' limit 1),
  'Hessisches Ministerium des Innern, für Sicherheit und Heimatschutz', E'Friedrich-Ebert-Allee 12\n65185 Wiesbaden', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'hmdis1')
  and exists (select 1 from kunden where name ilike '%competence center%')
on conflict (id) do nothing;

-- Pos. 1: Glas- und Rahmenreinigung, April (Anlage 1.2.1 + 1.2.2)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hmdis1-p1', 'hmdis1', '1', 'Glas- und Rahmenreinigung', '5227,34', 'feste_monate', '4', 0
where exists (select 1 from glas_objekte where id = 'hmdis1')
on conflict (id) do nothing;

-- Pos. 4: Glasreinigung (nur Glas), September (Anlage 1.2.3 + 1.2.4)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hmdis1-p4', 'hmdis1', '4', 'Glasreinigung', '5227,34', 'feste_monate', '9', 1
where exists (select 1 from glas_objekte where id = 'hmdis1')
on conflict (id) do nothing;
