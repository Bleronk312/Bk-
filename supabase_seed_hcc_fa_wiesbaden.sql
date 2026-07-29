-- HCC Wiesbaden (Kd.-Nr. 1070): zweites Objekt "Finanzamt Wiesbaden (BHZ ALP 3)",
-- Abraham-Lincoln-Park 3, 65189 Wiesbaden. Quelle: Anl. 1.3.1-1.3.4 PV GuR.
-- Gleiches Vergabepaket wie das Hessische Ministerium des Innern (Anlagen 1.2.x):
-- identische Systematik, SVS 28,13, Zeitraeume Apr./Mai + Sept./Okt.
--
-- Kunde wird NICHT neu angelegt - Verknuepfung ueber Kd.-Nr. 1070 bzw. den
-- bestehenden HCC-Kunden. Zwei Positionen wie beim Schwesterobjekt:
--   Pos. 1  Glas- und Rahmenreinigung   April (feste_monate '4')
--           = Anlage 1.3.1 Aussenglas 6.991,44 + 1.3.2 Innenglas 695,21 = 7686,65 qm
--   Pos. 4  Glasreinigung (ohne Rahmen) September (feste_monate '9')
--           = Anlage 1.3.3 Aussenglas 6.991,44 + 1.3.4 Innenglas 695,21 = 7686,65 qm
-- WICHTIG (steht in den Anlagen): Das Aussenglas wird NUR VON INNEN gereinigt
-- ("Der AN nimmt nur Innenreinigung der Fenster vor") -> als pos_text vermerkt.
-- Hoehenzugangstechnik-Pauschale (0 EUR) ist keine Flaeche und wurde nicht mitgezaehlt.
-- Vorlage: geko. Koordinaten ergaenzt die Admin-Seite automatisch.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- pos_text-Spalte sicherstellen (idempotent)
alter table glas_objekt_positionen add column if not exists pos_text text default '';
alter table glas_objekt_positionen add column if not exists einheit text not null default '';

-- Objekt anlegen, verknuepft mit dem bestehenden HCC-Kunden (Kd.-Nr. 1070)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hcc-fa-wiesbaden',
  k.id, k.name,
  k.name || case when coalesce(k.adresse,'') <> '' then E'\n' || k.adresse else '' end,
  'Finanzamt Wiesbaden (BHZ ALP 3)', E'Abraham-Lincoln-Park 3\n65189 Wiesbaden', '', '', '', 'geko', null, null
from (
  select id, name, adresse from kunden
  where kdnr = '1070' or id = 'kunde-hcc-wiesbaden' or name ilike '%competence center%'
  limit 1
) k
where not exists (select 1 from glas_objekte where id = 'hcc-fa-wiesbaden')
on conflict (id) do nothing;

-- Pos. 1: Glas- und Rahmenreinigung, April (Anlage 1.3.1 + 1.3.2)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, pos_text, einheit)
select 'hcc-fa-wiesbaden-p1', 'hcc-fa-wiesbaden', '1', 'Glas- und Rahmenreinigung', '7686,65', 'feste_monate', '4', 0,
  E'Außenglas 6991,44 qm + Innenglas 695,21 qm\nAußenglas: nur Innenreinigung der Fenster einschl. Rahmen', 'qm'
where exists (select 1 from glas_objekte where id = 'hcc-fa-wiesbaden')
on conflict (id) do nothing;

-- Pos. 4: Glasreinigung (ohne Rahmen), September (Anlage 1.3.3 + 1.3.4)
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge, pos_text, einheit)
select 'hcc-fa-wiesbaden-p4', 'hcc-fa-wiesbaden', '4', 'Glasreinigung', '7686,65', 'feste_monate', '9', 1,
  E'Außenglas 6991,44 qm + Innenglas 695,21 qm\nAußenglas: nur Innenreinigung der Fenster', 'qm'
where exists (select 1 from glas_objekte where id = 'hcc-fa-wiesbaden')
on conflict (id) do nothing;
