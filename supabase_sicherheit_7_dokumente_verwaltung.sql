-- ============================================================================
-- GEKO · Dokumente: die ganze Verwaltung darf hoch- und runterladen
-- ============================================================================
-- BISHER: nur der Ober-Admin. Das war meine Entscheidung beim Bauen, nicht
-- deine - Begründung damals: Lohn ist die sensibelste Information im Haus.
--
-- JETZT: die gesamte Verwaltung, ausdrücklich so gewünscht.
--
-- ----------------------------------------------------------------------------
-- ⚠️  WAS DAS BEDEUTET - bitte einmal bewusst lesen
--
-- Hochladen und Ansehen lassen sich beim Dateispeicher nicht sinnvoll trennen.
-- Wer hochlädt, muss die Liste sehen können, sonst weiß er nicht, ob es
-- geklappt hat, und kann nichts korrigieren.
--
-- Ab jetzt gilt deshalb: JEDER mit Verwaltungs-Rechten kann die
-- Lohnabrechnungen ALLER Mitarbeiter öffnen und löschen. Auch Bürokräfte, die
-- du erst in Zukunft anlegst - die bekommen das automatisch mit.
--
-- Wer Verwaltungs-Rechte hat, steht in den Einstellungen über den
-- Verwaltungs-Zugängen. Schau da hin und wieder drauf.
--
-- ----------------------------------------------------------------------------
-- WAS SICH NICHT ÄNDERT - und das ist der wichtige Teil
--
-- Für Mitarbeiter bleibt alles wie geprüft: Jeder sieht ausschließlich seinen
-- eigenen Ordner. Diese Regel wird unten NICHT angefasst. Der Angriffstest
-- (pruefe_lohn_zugriff.sh) muss danach dasselbe Ergebnis liefern wie vorher.
--
-- Ebenfalls unberührt: Passwörter zurücksetzen, Konten anlegen und sperren
-- bleiben allein beim Ober-Admin. Wer ein Passwort zurücksetzen kann, kann
-- sich anschließend als der Betreffende anmelden - diese Macht bleibt an einer
-- Person.
-- ============================================================================

-- Die alte Ober-Admin-Regel wird durch die weitere ersetzt. geko_ist_admin()
-- schließt den Ober-Admin mit ein (er trägt geko_rolle = 'admin' UND
-- geko_super = true), er verliert also nichts.
drop policy if exists "geko_lohn_oberadmin" on storage.objects;

drop policy if exists "geko_lohn_verwaltung" on storage.objects;
create policy "geko_lohn_verwaltung" on storage.objects
  for all to authenticated
  using (bucket_id = 'lohn' and geko_ist_admin())
  with check (bucket_id = 'lohn' and geko_ist_admin());

-- Die Mitarbeiter-Regel bleibt UNVERÄNDERT stehen. Hier zur Sicherheit noch
-- einmal gesetzt, falls sie in einer Installation fehlen sollte - identisch
-- zum Original aus supabase_add_lohn.sql.
drop policy if exists "geko_lohn_eigene" on storage.objects;
create policy "geko_lohn_eigene" on storage.objects
  for select to authenticated
  using (bucket_id = 'lohn' and (storage.foldername(name))[1] = geko_ma_id());


-- ---------------------------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------------------------
-- Erwartet: GENAU zwei Regeln - geko_lohn_verwaltung (ALL) und
-- geko_lohn_eigene (SELECT). Steht dort noch geko_lohn_oberadmin, ist das
-- drop oben nicht durchgelaufen.
select policyname, cmd
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like 'geko_lohn%'
 order by policyname;

-- Und zur Erinnerung: wer hat eigentlich Verwaltungs-Rechte?
-- (Die Liste sollte dich nicht überraschen.)
select m.name, m.username, 'Mitarbeiter mit Verwaltungs-Rolle' as art
  from glas_mitarbeiter m
  join auth.users u on u.id = m.auth_user_id
 where u.raw_app_meta_data ->> 'geko_rolle' = 'admin'
union all
select coalesce(u.raw_user_meta_data ->> 'name', u.email), u.email, 'reines Verwaltungs-Konto'
  from auth.users u
 where u.raw_app_meta_data ->> 'geko_rolle' = 'admin'
   and not exists (select 1 from glas_mitarbeiter m where m.auth_user_id = u.id)
 order by 3, 1;
