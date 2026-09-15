-- Migración: permite editar/borrar categorías y personas.
--
-- El schema original solo tenía políticas de lectura e inserción para
-- "requesters" y "categories" (y update/delete para "items"), así que
-- renombrar o borrar una categoría o una persona desde la app no fallaba,
-- pero tampoco cambiaba nada en la base: Postgres Row Level Security
-- filtra en silencio las filas que la política no autoriza, así que el
-- UPDATE/DELETE devuelve éxito con 0 filas afectadas.

create policy "requesters: public update" on requesters
  for update using (true) with check (true);
create policy "requesters: public delete" on requesters
  for delete using (true);

create policy "categories: public update" on categories
  for update using (true) with check (true);
create policy "categories: public delete" on categories
  for delete using (true);
