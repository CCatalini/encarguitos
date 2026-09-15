-- Migración:

-- 1. Columna de color por persona, con Cami/Meli ya asignadas.
alter table requesters
  add column if not exists color text not null default 'green';

alter table requesters
  drop constraint if exists requesters_color_check;
alter table requesters
  add constraint requesters_color_check
  check (color in ('green', 'pink', 'blue', 'amber', 'violet'));

update requesters set color = 'green' where name = 'Cami';
update requesters set color = 'pink' where name = 'Meli';

-- 2. Ahora se pueden crear personas nuevas desde la app: falta la
-- política de alta en requesters (antes solo se podía leer).
drop policy if exists "requesters: public insert" on requesters;
create policy "requesters: public insert" on requesters
  for insert with check (true);

-- 3. Sumar requesters a Realtime, para que una persona nueva aparezca
-- al instante en las otras pantallas abiertas sin recargar.
alter publication supabase_realtime add table requesters;
