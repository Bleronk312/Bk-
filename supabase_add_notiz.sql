-- Kleine Ergänzung: internes Notizfeld für Mitarbeiter (erscheint nicht im PDF)
alter table scheine add column if not exists interne_notiz text;
