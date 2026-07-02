-- Ergänzung: Vorher-/Nachher-Fotos (optional, nur in der App sichtbar, nicht im PDF)
alter table scheine add column if not exists vorher_fotos text;
alter table scheine add column if not exists nachher_fotos text;
