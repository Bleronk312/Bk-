-- Hochschule Niederrhein (Glasreinigung): Kunde + 3 Objekte (Lose 1-3) aus
-- Anlage 1 - Preisblatt (Standorte Krefeld + Moenchengladbach).
-- Je Objekt zwei Positionen, beide Pos. 1: Aussenglas (Aussenfenster und -tueren)
-- und Innenglas (Tuerglas innen). qm je Los aus dem Preisblatt summiert.
-- Intervall: 1x jaehrlich im August (feste_monate '8') fuer Aussen und Innen.
-- Kd.-Nr. war im Preisblatt nicht angegeben (bleibt leer). Vorlage: geko.
-- PLZ recherchiert/verifiziert (Krefeld West 47798, Moenchengladbach 41065).
-- Koordinaten werden beim naechsten Oeffnen der Admin-Seite automatisch ergaenzt.
-- Stabile IDs + on conflict do nothing: sicher mehrfach ausfuehrbar. SQL Editor -> Run.

-- Kunde anlegen, falls es ihn noch nicht gibt
insert into kunden (id, name, adresse, kdnr, bereich)
select 'kunde-hs-niederrhein', 'Hochschule Niederrhein', E'Reinarzstraße 49\n47805 Krefeld', '', 'glas'
where not exists (select 1 from kunden where name ilike '%niederrhein%');

-- Campus Krefeld Süd (Los 1)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hsnr1', (select id from kunden where name ilike '%niederrhein%' limit 1), (select name from kunden where name ilike '%niederrhein%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%niederrhein%' limit 1), 'Campus Krefeld Süd (Los 1)', E'Reinarzstraße 49\n47805 Krefeld', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'hsnr1')
  and exists (select 1 from kunden where name ilike '%niederrhein%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hsnr1-aussen', 'hsnr1', '1', 'Glas- und Rahmenreinigung – Außenglas', '9585', 'feste_monate', '8', 0
where exists (select 1 from glas_objekte where id = 'hsnr1') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hsnr1-innen', 'hsnr1', '1', 'Glas- und Rahmenreinigung – Innenglas', '3254', 'feste_monate', '8', 1
where exists (select 1 from glas_objekte where id = 'hsnr1') on conflict (id) do nothing;

-- Campus Krefeld West (Los 2)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hsnr2', (select id from kunden where name ilike '%niederrhein%' limit 1), (select name from kunden where name ilike '%niederrhein%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%niederrhein%' limit 1), 'Campus Krefeld West (Los 2)', E'Frankenring 20\n47798 Krefeld', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'hsnr2')
  and exists (select 1 from kunden where name ilike '%niederrhein%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hsnr2-aussen', 'hsnr2', '1', 'Glas- und Rahmenreinigung – Außenglas', '3682', 'feste_monate', '8', 0
where exists (select 1 from glas_objekte where id = 'hsnr2') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hsnr2-innen', 'hsnr2', '1', 'Glas- und Rahmenreinigung – Innenglas', '1468', 'feste_monate', '8', 1
where exists (select 1 from glas_objekte where id = 'hsnr2') on conflict (id) do nothing;

-- Campus Mönchengladbach (Los 3)
insert into glas_objekte (id, kunde_id, kunde_name, kunde_adresse, name, adresse, kdnr, ansprechpartner, telefon, template, lat, lng)
select 'hsnr3', (select id from kunden where name ilike '%niederrhein%' limit 1), (select name from kunden where name ilike '%niederrhein%' limit 1), (select name || case when coalesce(adresse,'') <> '' then E'\n' || adresse else '' end from kunden where name ilike '%niederrhein%' limit 1), 'Campus Mönchengladbach (Los 3)', E'Webschulstraße 41–43\n41065 Mönchengladbach', '', '', '', 'geko', null, null
where not exists (select 1 from glas_objekte where id = 'hsnr3')
  and exists (select 1 from kunden where name ilike '%niederrhein%')
on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hsnr3-aussen', 'hsnr3', '1', 'Glas- und Rahmenreinigung – Außenglas', '7746', 'feste_monate', '8', 0
where exists (select 1 from glas_objekte where id = 'hsnr3') on conflict (id) do nothing;
insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
select 'hsnr3-innen', 'hsnr3', '1', 'Glas- und Rahmenreinigung – Innenglas', '983', 'feste_monate', '8', 1
where exists (select 1 from glas_objekte where id = 'hsnr3') on conflict (id) do nothing;

