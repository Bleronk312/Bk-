-- Behebt: "permission denied for table push_subscriptions"
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table push_subscriptions to anon, authenticated, service_role;
