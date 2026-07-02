-- Material-/Zeit-Erfassung nach der Unterschrift
alter table scheine add column if not exists material_erfasst boolean not null default false;
alter table scheine add column if not exists material_stunden text;
alter table scheine add column if not exists material_graffiti_ex_spray integer;
alter table scheine add column if not exists material_graffiti_gel integer;
alter table scheine add column if not exists material_paint_cleaner integer;
alter table scheine add column if not exists material_streichen boolean default false;
alter table scheine add column if not exists material_hochdruck boolean default false;
alter table scheine add column if not exists material_sandstrahl boolean default false;
alter table scheine add column if not exists material_freitext text;
