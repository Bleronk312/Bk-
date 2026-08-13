-- GEKO One (Mitarbeiter-Übersicht unter /meine.html):
-- Ein Login für alles - die Mitarbeiter melden sich mit ihrem BESTEHENDEN
-- Glas-/Check-ins-Konto an und sehen eine Übersicht mit ihren freigeschalteten
-- Bereichen. Diese Datei ergänzt nur Spalten, ändert nichts Bestehendes.

-- Freischaltung für den Graffiti-Baustein (analog zu zugang_glas / zugang_checkin).
alter table glas_mitarbeiter add column if not exists zugang_graffiti boolean not null default false;

-- Hat der Mitarbeiter sein Passwort selbst gesetzt? Dann wurde das Klartext-Feld
-- (pass_klar) geleert und NIEMAND kann das Passwort mehr einsehen - auch das Büro
-- nicht. Das Büro kann nur noch zurücksetzen (neues Einmal-Passwort vergeben).
alter table glas_mitarbeiter add column if not exists pw_selbst_gesetzt boolean not null default false;

-- Nach einem Zurücksetzen durch das Büro: Beim nächsten Login MUSS der Mitarbeiter
-- sofort ein eigenes Passwort festlegen, bevor er weiterkommt.
alter table glas_mitarbeiter add column if not exists pw_muss_wechsel boolean not null default false;
