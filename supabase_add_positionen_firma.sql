-- Positionen einer Firma zuordnen: GEKO Clean ('geko') oder Dietrich ('sub').
-- Betrifft sowohl die Leistungsarten-Stammdaten (Positionskatalog) als auch die
-- konkret an einem Objekt hinterlegten Positionen. Idempotent - kann gefahrlos erneut
-- ausgeführt werden. Bestehende Einträge gelten als 'geko'.
alter table glas_positionen add column if not exists template text default 'geko';
alter table glas_objekt_positionen add column if not exists template text default 'geko';
