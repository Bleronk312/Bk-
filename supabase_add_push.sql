-- Push-Benachrichtigungen: Tabelle für die Geräte-Anmeldungen
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('admin', 'mitarbeiter')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
create policy "anon_full_access_push" on push_subscriptions for all using (true) with check (true);
grant select, insert, update, delete on table push_subscriptions to anon, authenticated;
