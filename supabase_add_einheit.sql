-- Eigene Positionen: explizite Einheit (QM oder Stunden).
-- "qm" | "std" | "" (leer = alte Regel: Pos.-Nr. 2/5 gilt als Stunden).
alter table glas_objekt_positionen add column if not exists einheit text not null default '';
