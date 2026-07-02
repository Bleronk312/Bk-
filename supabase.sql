-- Komplettes Datenbank-Setup (für eine komplett neue Installation).
-- Falls du schon eine bestehende Installation aktualisierst, nutze
-- stattdessen supabase_update.sql.

create table if not exists scheine (
  id text primary key,
  kunde text not null default '',
  adresse text not null default '',
  ansprechpartner text not null default '',
  telefon text not null default '',
  kategorie text not null default '',
  leistungen text not null default '',
  monat text not null default '',
  kdnr text not null default '',
  datum date,
  unterschrift text,
  unterschrift_name text,
  anhang text,
  anhang_name text,
  anhang_type text,
  interne_notiz text,
  vorher_fotos text,
  nachher_fotos text,
  termin timestamptz,
  archiviert boolean not null default false,
  material_erfasst boolean not null default false,
  material_stunden text,
  material_graffiti_ex_spray integer,
  material_graffiti_gel integer,
  material_paint_cleaner integer,
  material_streichen boolean default false,
  material_hochdruck boolean default false,
  material_sandstrahl boolean default false,
  material_freitext text,
  created_at timestamptz not null default now(),
  signed_at timestamptz
);

alter table scheine enable row level security;
create policy "anon_full_access" on scheine for all using (true) with check (true);
grant select, insert, update, delete on table scheine to anon, authenticated;

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

create table if not exists kategorien (
  id text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);

alter table kategorien enable row level security;
create policy "anon_full_access_kategorien" on kategorien for all using (true) with check (true);
grant select, insert, update, delete on table kategorien to anon, authenticated;

grant usage on schema public to anon, authenticated;
