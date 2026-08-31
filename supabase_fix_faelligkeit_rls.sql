-- ===========================================================================
-- FIX: "Fällig" bleibt stehen, obwohl unterschrieben wurde
--
-- WAS WAR LOS
-- Beim Unterschreiben setzt die App auf den Positionen des Scheins
-- "letzte_reinigung" neu (glasSignStop in js/glas-shared.js) - erst dadurch
-- wandert die Fälligkeit weiter. Sie schickt dafür:
--
--     update glas_objekt_positionen set letzte_reinigung = ...
--     where id in ('p1','p2')
--
-- Seit der RLS-Umstellung gibt es auf glas_objekt_positionen zwar eine
-- UPDATE-Regel für Mitarbeiter, aber ABSICHTLICH keine SELECT-Regel. Genau
-- das ist der Fehler: das "where id in (...)" muss die Zeilen erst FINDEN,
-- und Suchen ist Lesen. Ohne Leserecht findet Postgres null Zeilen und
-- ändert null Zeilen - ohne jede Fehlermeldung. Die Unterschrift sitzt, die
-- Fälligkeit bleibt stehen. (Nachgestellt und bewiesen: "update ... where"
-- ändert 0 Zeilen, dasselbe "update" OHNE where ändert 2.)
--
-- Betroffen ist jede Unterschrift, die ein MITARBEITER seit der
-- RLS-Umstellung geholt hat - also quer über alle Objekte. Unterschriften
-- aus der Verwaltungs-Oberfläche waren nie betroffen (Verwaltung darf alles).
--
-- WIE ES REPARIERT WIRD
-- Schritt 1 hängt die Nachführung dort auf, wo sie hingehört: an die
-- Datenbank selbst. Sobald ein Stopp auf "erledigt" springt, setzt ein
-- Trigger die Fälligkeit weiter - egal wer unterschreibt, egal ob aus der
-- Mitarbeiter-App, aus der Verwaltung oder aus der Offline-Warteschlange.
-- Damit ist KEIN neues Leserecht nötig, die Abschottung bleibt wie sie ist,
-- und stillschweigend schiefgehen kann es nicht mehr - es läuft im selben
-- Vorgang wie die Unterschrift.
--
-- Schritt 2 holt nach, was seit der Umstellung liegen geblieben ist.
-- Schritt 3 zeigt zur Kontrolle, was dabei herauskam.
--
-- Gefahrlos: Fälligkeiten wandern nur VORWÄRTS. Ein bereits eingetragenes
-- "zuletzt gereinigt" wird nie durch ein älteres Datum überschrieben.
-- Das Skript darf beliebig oft laufen.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Schritt 1: Nachführung als Trigger an der Datenbank
-- ---------------------------------------------------------------------------

-- Kleiner Helfer: der Positions-Schnappschuss eines Stopps ist ein Text-Feld.
-- Steht da Unsinn drin (leer, kaputtes JSON, kein Array), soll das NIE eine
-- Unterschrift blockieren - dann kommt eben eine leere Liste zurück.
create or replace function geko_json_liste(t text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if t is null or btrim(t) = '' then return '[]'::jsonb; end if;
  if jsonb_typeof(t::jsonb) <> 'array' then return '[]'::jsonb; end if;
  return t::jsonb;
exception when others then
  return '[]'::jsonb;
end $$;

create or replace function geko_reinigung_nachfuehren()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eintrag jsonb;
  pid text;
  tag date;
begin
  -- Nur der Moment, in dem ein Stopp erledigt WIRD. Ein späteres Bearbeiten
  -- eines bereits unterschriebenen Scheins (z.B. eine Positionskorrektur)
  -- lässt die Fälligkeiten bewusst in Ruhe.
  if new.status is distinct from 'erledigt' then return new; end if;
  if tg_op = 'UPDATE' and old.status is not distinct from 'erledigt' then return new; end if;

  -- Tag der Reinigung: das eingefrorene Unterschrift-Datum, sonst der
  -- Zeitstempel (in unserer Zeitzone), sonst heute.
  tag := coalesce(new.datum, (new.signed_at at time zone 'Europe/Berlin')::date, current_date);

  for eintrag in select * from jsonb_array_elements(geko_json_liste(new.positionen)) loop
    pid := eintrag ->> 'id';
    continue when pid is null or pid = '';
    -- Nur vorwärts: eine jüngere Reinigung darf nie von einer älteren
    -- überschrieben werden (z.B. wenn ein alter Schein nachgetragen wird).
    update glas_objekt_positionen
       set letzte_reinigung = tag,
           faelligkeit_override = null
     where id = pid
       and (letzte_reinigung is null or letzte_reinigung <= tag);
  end loop;

  return new;
end $$;

drop trigger if exists geko_reinigung_nachfuehren on glas_stopps;
create trigger geko_reinigung_nachfuehren
  after insert or update on glas_stopps
  for each row execute function geko_reinigung_nachfuehren();


-- ---------------------------------------------------------------------------
-- Schritt 2: Liegengebliebenes nachholen
-- ---------------------------------------------------------------------------
-- Für jede Position: das jüngste Unterschrift-Datum aller erledigten Stopps,
-- auf denen sie steht. Eingetragen wird nur, wenn das NEUER ist als das, was
-- schon drinsteht - nichts wird zurückgedreht.
--
-- "faelligkeit_override" (die Verschiebungen von Hand) wird hier bewusst NICHT
-- angefasst: ob eine Verschiebung vor oder nach der Reinigung eingetragen
-- wurde, lässt sich nachträglich nicht sicher sagen, und eine bewusste
-- Entscheidung der Verwaltung soll dieses Skript nicht überfahren.
-- Schritt 3 listet auf, welche das betrifft.

update glas_objekt_positionen op
   set letzte_reinigung = q.letzte
  from (
    select p ->> 'id' as pid,
           max(coalesce(s.datum, (s.signed_at at time zone 'Europe/Berlin')::date)) as letzte
      from glas_stopps s
      cross join lateral jsonb_array_elements(geko_json_liste(s.positionen)) p
     where s.status = 'erledigt'
       and coalesce(s.datum, (s.signed_at at time zone 'Europe/Berlin')::date) is not null
       and coalesce(p ->> 'id', '') <> ''
     group by 1
  ) q
 where op.id = q.pid
   and (op.letzte_reinigung is null or op.letzte_reinigung < q.letzte);


-- ---------------------------------------------------------------------------
-- Schritt 3: Kontrolle
-- ---------------------------------------------------------------------------

-- 3a) Gibt es noch unterschriebene Scheine, deren Positionen NICHT nachgeführt
--     sind? Hier muss 0 stehen.
select count(*) as noch_offen_nach_reparatur
  from (
    select p ->> 'id' as pid,
           max(coalesce(s.datum, (s.signed_at at time zone 'Europe/Berlin')::date)) as letzte
      from glas_stopps s
      cross join lateral jsonb_array_elements(geko_json_liste(s.positionen)) p
     where s.status = 'erledigt'
       and coalesce(s.datum, (s.signed_at at time zone 'Europe/Berlin')::date) is not null
       and coalesce(p ->> 'id', '') <> ''
     group by 1
  ) q
  join glas_objekt_positionen op on op.id = q.pid
 where op.letzte_reinigung is null or op.letzte_reinigung < q.letzte;

-- 3b) Positionen, die eine Reinigung bekommen haben und ZUSÄTZLICH eine
--     Verschiebung von Hand tragen. Bei denen entscheidet weiterhin die
--     Verschiebung über die Fälligkeit - das Skript fasst sie bewusst nicht
--     an. Meist eine Handvoll; bitte in der App kurz durchsehen. Steht in
--     "hinweis" ein "veraltet", zeigt die Verschiebung auf einen Termin, der
--     durch die Reinigung überholt ist - die gehört in der App gelöscht.
select op.id, op.nr, op.art, op.letzte_reinigung, op.faelligkeit_override,
       case when op.faelligkeit_override <= op.letzte_reinigung
            then 'veraltet - in der App entfernen'
            else 'geplante Verschiebung, bleibt' end as hinweis
  from glas_objekt_positionen op
 where op.faelligkeit_override is not null
   and op.letzte_reinigung is not null
 order by op.faelligkeit_override <= op.letzte_reinigung desc, op.letzte_reinigung desc;

-- 3c) Der Trigger muss da sein - eine Zeile, "enabled" = O.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'glas_stopps'::regclass
   and not tgisinternal;
