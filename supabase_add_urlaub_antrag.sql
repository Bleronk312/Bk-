-- Urlaubsanträge aus GEKO One: Der Mitarbeiter beantragt Urlaub selbst im Kalender,
-- das Büro genehmigt oder lehnt ab. Bisher trug nur der Admin Urlaub ein - jede Zeile
-- galt automatisch als gültig.

-- Status des Urlaubs:
--   'genehmigt'  = gültig (Standard, damit ALLE bisherigen Einträge unverändert gelten!)
--   'offen'      = vom Mitarbeiter beantragt, wartet auf das Büro
--   'abgelehnt'  = vom Büro abgelehnt
alter table glas_urlaub add column if not exists status text not null default 'genehmigt';

-- Wer hat beantragt/entschieden und wann (für die Nachvollziehbarkeit im Büro)
alter table glas_urlaub add column if not exists beantragt_am timestamptz;
alter table glas_urlaub add column if not exists entschieden_am timestamptz;
alter table glas_urlaub add column if not exists entschieden_von text;

-- Begründung des Büros bei einer Ablehnung (erscheint beim Mitarbeiter)
alter table glas_urlaub add column if not exists antwort text not null default '';

create index if not exists idx_glas_urlaub_status on glas_urlaub(status);

-- Benachrichtigung ans Büro, sobald ein Mitarbeiter Urlaub beantragt.
-- Standard: AN (default true) - sonst würde man die ersten Anträge verpassen.
alter table glas_einstellungen add column if not exists push_urlaub boolean not null default true;

-- Hat der Mitarbeiter die Entscheidung des Büros zur Kenntnis genommen?
-- Solange leer, steht der Hinweis (genehmigt/abgelehnt) auf seiner GEKO-One-Startseite.
-- Nach dem Bestätigen verschwindet er dort und steht nur noch in seiner Antrags-Historie.
alter table glas_urlaub add column if not exists gesehen_am timestamptz;
