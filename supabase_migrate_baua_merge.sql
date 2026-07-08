-- ============================================================================
-- BAuA Dortmund: die zwei getrennten Objekte (Los 2.1-2.3 "Haus I, II, IV" und
-- Los 2.4 "Haus III") zu EINEM Objekt "BAuA Haus I-IV" zusammenfuehren.
--
-- VERLAUF-ERHALTEND: Das bestehende Objekt "Haus I, II, IV" wird weiterverwendet
-- (damit letzte_reinigung + unterschriebene Scheine erhalten bleiben), die qm
-- werden ueber beide Lose summiert, die "alle 2 Monate"-Position (nur in Haus III)
-- ergaenzt, und die Scheine/Stopps von Haus III werden auf das zusammengefuehrte
-- Objekt umgehaengt. Danach wird das leere Haus-III-Objekt entfernt.
--
-- SICHER: Sucht sich Kunde/Objekte selbst; bricht mit Fehlermeldung ab, wenn die
-- erwartete Struktur (genau 2 BAuA-Objekte) nicht vorliegt - dann wird NICHTS
-- geaendert. Unterschriebene Scheine bleiben inhaltlich unangetastet.
-- Mehrfach ausfuehrbar. In Supabase SQL Editor einfuegen -> Run.
-- Summen: Monatsreinigung 371,76 + 781,08 = 1152,84 | alle 2 Monate 536,66 (nur Haus III)
--         Grossreinigung 7502,46 + 5714,07 = 13216,53
-- ============================================================================
do $$
declare
  v_kunde text;
  v_base  text;   -- Basis-Objekt (Haus I, II, IV) -> wird "BAuA Haus I-IV"
  v_other text;   -- das andere BAuA-Objekt (Haus III)
  v_cnt   integer;
begin
  -- BAuA-Kunde finden
  select id into v_kunde from kunden where name ilike '%arbeitsschutz%' limit 1;
  if v_kunde is null then
    raise exception 'BAuA-Kunde (Arbeitsschutz) nicht gefunden - Abbruch, nichts geaendert.';
  end if;

  -- Erwartung: genau 2 BAuA-Objekte. Sonst abbrechen (keine Ueberraschungen).
  select count(*) into v_cnt from glas_objekte where kunde_id = v_kunde;
  if v_cnt <> 2 then
    raise exception 'Erwarte genau 2 BAuA-Objekte, gefunden: % - Abbruch, nichts geaendert. Bitte Bescheid geben.', v_cnt;
  end if;

  -- Basis = "Haus I, II, IV"; das andere = Haus III
  select id into v_base  from glas_objekte where kunde_id = v_kunde and name ilike '%Haus I, II, IV%' limit 1;
  if v_base is null then
    raise exception 'Basis-Objekt "Haus I, II, IV" nicht gefunden - Abbruch, nichts geaendert.';
  end if;
  select id into v_other from glas_objekte where kunde_id = v_kunde and id <> v_base limit 1;

  -- 1) Basis-Objekt umbenennen
  update glas_objekte set name = 'BAuA Haus I-IV' where id = v_base;

  -- 2) Monatsreinigung: qm = Summe beider Lose, Pos. -> 1 (letzte_reinigung bleibt erhalten)
  update glas_objekt_positionen
     set qm = '1152,84', nr = '1', reihenfolge = 0
   where objekt_id = v_base and intervall_typ = 'feste_monate'
     and feste_monate = '1,2,3,4,5,6,7,8,9,10,11,12';

  -- 3) Grossreinigung: qm = Summe beider Lose, Pos. -> 1
  update glas_objekt_positionen
     set qm = '13216,53', nr = '1', reihenfolge = 2
   where objekt_id = v_base and intervall_typ = 'feste_monate'
     and feste_monate = '4,10';

  -- 4) "alle 2 Monate" (nur in Haus III) am Basis-Objekt ergaenzen, falls noch nicht vorhanden
  if not exists (
    select 1 from glas_objekt_positionen
     where objekt_id = v_base and intervall_typ = 'feste_monate' and feste_monate = '2,4,6,8,10,12'
  ) then
    insert into glas_objekt_positionen (id, objekt_id, nr, art, qm, intervall_typ, feste_monate, reihenfolge)
    values ('baua-i-iv-alle2m', v_base, '1', 'Glas- und Rahmenreinigung - alle 2 Monate',
            '536,66', 'feste_monate', '2,4,6,8,10,12', 1);
  end if;

  -- 5) Haus III mergen: dessen Scheine/Stopps (Verlauf) auf das Basis-Objekt umhaengen,
  --    dann das leere Haus-III-Objekt loeschen (seine Positionen via ON DELETE CASCADE).
  if v_other is not null then
    update glas_stopps set objekt_id = v_base where objekt_id = v_other;
    delete from glas_objekte where id = v_other;
  end if;

  raise notice 'BAuA-Merge ok: Basis-Objekt % ist jetzt "BAuA Haus I-IV" mit 3 Positionen; Haus III (%) zusammengefuehrt.', v_base, v_other;
end $$;
