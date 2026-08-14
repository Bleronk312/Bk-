-- GEKO Lager-Plan: Das Büro legt fest, wer morgens um wieviel Uhr im Lager sein
-- soll, und schickt es den Betroffenen aufs Handy. Bewusst einfach gehalten:
-- eine Zeile = eine Uhrzeit an einem Tag + die Leute, die dann da sein sollen.

create table if not exists glas_lager_plan (
  id text primary key,
  datum date not null,
  uhrzeit text not null default '06:00',          -- "HH:MM"
  mitarbeiter_ids jsonb not null default '[]'::jsonb,
  notiz text not null default '',                 -- z.B. "Material für Kreishaus mitnehmen"
  gesendet_am timestamptz,                        -- wann die Benachrichtigung rausging
  created_at timestamptz not null default now()
);

alter table glas_lager_plan enable row level security;
drop policy if exists "anon_full_access_glas_lager_plan" on glas_lager_plan;
create policy "anon_full_access_glas_lager_plan" on glas_lager_plan for all using (true) with check (true);
grant select, insert, update, delete on table glas_lager_plan to anon, authenticated;

create index if not exists idx_glas_lager_plan_datum on glas_lager_plan(datum);

-- Freischaltung wie bei den anderen Bausteinen: nur wer den Lager-Baustein sieht,
-- erscheint im Admin auch in der Auswahlliste - und sieht die Kachel in GEKO One.
alter table glas_mitarbeiter add column if not exists zugang_lager boolean not null default false;

-- Benachrichtigung ans Handy, wenn das Buero den Lager-Plan verschickt.
alter table glas_einstellungen add column if not exists push_lager boolean not null default true;

-- Lese-Bestaetigung: der Mitarbeiter hakt seine Einteilung in GEKO One ab.
-- Aufbau: { "<mitarbeiter_id>": "<zeitstempel>" } - das Buero sieht, wer's gelesen hat.
alter table glas_lager_plan add column if not exists bestaetigt jsonb not null default '{}'::jsonb;
