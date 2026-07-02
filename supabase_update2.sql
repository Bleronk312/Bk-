-- Neue Felder für: Termin, Archivierung
alter table scheine add column if not exists termin timestamptz;
alter table scheine add column if not exists archiviert boolean not null default false;
