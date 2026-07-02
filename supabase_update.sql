-- Migration für die neuen Funktionen: Kunden, Kategorien, Anhang, Name des Unterschreibenden
-- Im Supabase SQL-Editor ausführen (einmalig)

-- Neue Tabelle: Kunden-Stammdaten
create table if not exists kunden (
  id text primary key,
  name text not null default '',
  adresse text not null default '',
  kdnr text not null default '',
  created_at timestamptz not null default now()
);

alter table kunden enable row level security;
create policy "anon_full_access_kunden" on kunden for all using (true) with check (true);
grant select, insert, update, delete on table kunden to anon, authenticated;

-- Neue Tabelle: Kategorien-Stammdaten
create table if not exists kategorien (
  id text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);

alter table kategorien enable row level security;
create policy "anon_full_access_kategorien" on kategorien for all using (true) with check (true);
grant select, insert, update, delete on table kategorien to anon, authenticated;

-- Neue Spalten in der bestehenden scheine-Tabelle
alter table scheine add column if not exists unterschrift_name text;
alter table scheine add column if not exists anhang text;
alter table scheine add column if not exists anhang_name text;
alter table scheine add column if not exists anhang_type text;
alter table scheine add column if not exists interne_notiz text;
alter table scheine add column if not exists vorher_fotos text;
alter table scheine add column if not exists nachher_fotos text;
