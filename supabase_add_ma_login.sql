-- Mitarbeiter-Login für die Glas-Touren-App.
-- Jeder Mitarbeiter kann einen Benutzernamen + Passwort bekommen und einzeln
-- gesperrt/entsperrt werden. Passwort wird als Hash (Login) UND im Klartext (zum
-- Nachschauen durch den Admin) gespeichert.
alter table glas_mitarbeiter add column if not exists username text;
alter table glas_mitarbeiter add column if not exists pass_hash text;
alter table glas_mitarbeiter add column if not exists pass_salt text;
alter table glas_mitarbeiter add column if not exists login_aktiv boolean not null default true;

-- Wer hat die Unterschrift vor Ort geholt (Anzeigename des angemeldeten Accounts)?
alter table glas_stopps add column if not exists erfasst_von text;

-- Passwort zusaetzlich im Klartext, damit es der Admin (hinter dem PIN) nachschauen kann.
alter table glas_mitarbeiter add column if not exists pass_klar text;
