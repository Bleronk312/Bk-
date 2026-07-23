-- ============================================================================
-- GEKO Check-ins – Benachrichtigungen (Push)
-- 1) Admin bekommt Push bei jedem Check-in (Rundgang + Arbeitszeit).
-- 2) Mitarbeiter bekommt eine Erinnerung ans Auschecken (vor + nach Feierabend).
-- Baut auf dem vorhandenen Push-System auf (push_subscriptions + send-push).
-- Voraussetzung: supabase_add_push.sql und supabase_add_arbeitszeit.sql sind gelaufen.
-- ============================================================================

-- Rollen-Constraint entfernen, damit auch die neuen Rollen 'checkin_admin' und
-- 'checkin_ma' erlaubt sind (die App nutzt ohnehin schon mehrere Rollen-Namen).
alter table push_subscriptions drop constraint if exists push_subscriptions_role_check;

-- Für gezielte Erinnerungen an EINEN Mitarbeiter: dessen ID an der Geräte-Anmeldung.
alter table push_subscriptions add column if not exists mitarbeiter_id text;

-- Geplanter Start/Ende einer Schicht als fester Zeitpunkt (vom Handy beim Einchecken
-- gesetzt) – so muss die geplante Funktion keine Zeitzonen-Mathematik machen.
alter table checkin_schichten add column if not exists plan_start_ts timestamptz;
alter table checkin_schichten add column if not exists plan_ende_ts timestamptz;

-- Merker, damit die Erinnerungen nicht spammen.
alter table checkin_schichten add column if not exists erinnert_vor boolean not null default false;
alter table checkin_schichten add column if not exists erinnert_nach_ts timestamptz;

create index if not exists push_subscriptions_ma_idx on push_subscriptions (mitarbeiter_id);
