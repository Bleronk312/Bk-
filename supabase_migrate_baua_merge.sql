-- ============================================================================
-- BAuA Dortmund: sicherstellen, dass es EIN Objekt "BAuA Haus I-IV" mit drei
-- Positionen (Pos. 1) gibt - Monatsreinigung, alle 2 Monate, Grossreinigung.
--
-- IDEMPOTENT & robust: funktioniert egal ob aktuell noch 2 getrennte Objekte
-- (Los 2.1-2.3 + Los 2.4) vorliegen ODER bereits 1 (z.B. weil ein frueherer
-- Lauf schon zusammengefuehrt oder ein Objekt von Hand geloescht wurde).
-- Mehrfach ausfuehrbar. Unterschriebene Scheine bleiben inhaltlich unangetastet;
-- vorhandene letzte_reinigung bleibt erhalten (Zeilen werden nur aktualisiert,
-- nicht neu angelegt). In Supabase SQL Editor einfuegen -> Run.
--
-- Summen: Monatsreinigung 371,76 + 781,08 = 1152,84
--         alle 2 Monate   536,66 (nur Haus III)
--         Grossreinigung  7502,46 + 5714,07 = 13216,53
-- ============================================================================
do $$
declare
  v_kunde text;
  v_base  text;   -- Ziel-Objekt "BAuA Haus I-IV"
  v_other text;   -- evtl. noch vorhandenes zweites Objekt (wird eingemergt)
  v_cnt   integer;
begin
  -- BAuA-Kunde finden
  select id into v_kunde from kunden where name ilike '%arbeitsschutz%' limit 1;
  if v_kunde is null then
    raise exception 'BAuA-Kunde (Arbeitsschutz) nicht gefunden - Abbruch, nichts geaendert.';
  end if;

  select count(*) into v_cnt from glas_objekte where kunde_id = v_kunde;
  if v_cnt = 0 then
    raise exception 'Kein BAuA-Objekt gefunden - Abbruch, nichts geaendert.';
  end if;

  -- Basis-Objekt bestimmen: bevorzugt das bereits zusammengefuehrte oder das
  -- "Haus I, II, IV"-Objekt; sonst einfach das (einzige) vorhandene Objekt.
  select id into v_base from glas_objekte
    where kunde_id = v_kunde and name ilike '%Haus I%IV%' limit 1;
  if v_base is null then
    select id into v_base from glas_objekte
      where kunde_id = v_kunde order by created_at limit 1;
  end if;

  -- 1) Basis-Objekt einheitlich benennen
  update glas_objekte set name = 'BAuA Haus I-IV' where id = v_base;

  -- 2) Monatsreinigung: qm = Summe beider Lose, Pos. 1 (letzte_reinigung bleibt)
  update glas_objekt_positionen
     set qm = '1152,84', nr = '1', reihenfolge = 0
   where objekt_id = v_base and intervall_typ = 'feste_monate'
     and feste_monate = '1,2,3,4,5,6,7,8,9,10,11,12';

  -- 3) Grossreinigung: qm = Summe beider Lose, Pos. 1
  update glas_objekt_positionen
     set qm = '13216,53', nr = '1', reihenfolge = 2
   where objekt_id = v_base and intervall_typ = 'feste_monate'
     and feste_monate = '4,10';

  -- 4) "alle 2 Monate" (Pos. 1) sicherstellen - anlegen, falls noch nicht vorhanden
  if not exists (
    select 1 from glas_objekt_positionen
     where objekt_id = v_base and intervall_typ = 'feste_monate' and feste_monate = '2,4,6,8,10,12'
  ) then
    insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
    values ('baua-i-iv-alle2m', v_base, '1', 'Glas- und Rahmenreinigung - alle 2 Monate',
            '536,66', 'feste_monate', '2,4,6,8,10,12', 1);
  else
    update glas_objekt_positionen
       set qm = '536,66', nr = '1', reihenfolge = 1
     where objekt_id = v_base and intervall_typ = 'feste_monate' and feste_monate = '2,4,6,8,10,12';
  end if;

  -- 5) Falls doch noch ein zweites BAuA-Objekt existiert: Verlauf umhaengen + loeschen
  select id into v_other from glas_objekte
    where kunde_id = v_kunde and id <> v_base limit 1;
  if v_other is not null then
    update glas_stopps set objekt_id = v_base where objekt_id = v_other;
    delete from glas_objekte where id = v_other;   -- Positionen via ON DELETE CASCADE
  end if;

  raise notice 'BAuA ok: Objekt % heisst jetzt "BAuA Haus I-IV" mit 3 Positionen (Pos. 1). Zusammengefuehrt: %.',
    v_base, coalesce(v_other, '(kein zweites Objekt)');
end $$;
