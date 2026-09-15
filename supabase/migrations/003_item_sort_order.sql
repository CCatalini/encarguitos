-- Migración: Suma orden manual a los ítems dentro de cada

alter table items
  add column if not exists sort_order integer not null default 0;

-- Backfill: a los ítems que ya existen les asigna un orden secuencial
-- por categoría, respetando el orden en que se cargaron (created_at),
-- para que no salten de lugar la primera vez que abrís la app.
with numbered as (
  select id, row_number() over (
    partition by category_id order by created_at
  ) - 1 as rn
  from items
)
update items
set sort_order = numbered.rn
from numbered
where items.id = numbered.id;
