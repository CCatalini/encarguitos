-- Permite varias fotos por ítem (galería con carrusel en la app), en vez
-- de una sola. Correr una vez en el SQL Editor de Supabase contra un
-- proyecto que ya tenga el schema anterior (con items.image_url).
--
-- Es seguro correrla más de una vez: la tabla, los índices y las
-- políticas usan "if not exists" / "drop policy if exists", y la
-- migración de datos sólo copia lo que falte.

create table if not exists item_images (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references items(id) on delete cascade,
    url text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
    );

create index if not exists item_images_item_id_idx on item_images(item_id);

alter table item_images enable row level security;

drop policy if exists "item_images: public read" on item_images;
create policy "item_images: public read" on item_images
  for select using (true);

drop policy if exists "item_images: public insert" on item_images;
create policy "item_images: public insert" on item_images
  for insert with check (true);

drop policy if exists "item_images: public update" on item_images;
create policy "item_images: public update" on item_images
  for update using (true) with check (true);

drop policy if exists "item_images: public delete" on item_images;
create policy "item_images: public delete" on item_images
  for delete using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'item_images'
  ) then
    alter publication supabase_realtime add table item_images;
  end if;
end $$;

-- Migra la foto que cada ítem ya tenía (columna vieja) a la tabla nueva,
-- sin duplicar si se vuelve a correr.
insert into item_images (item_id, url, sort_order)
select items.id, items.image_url, 0
from items
where items.image_url is not null
  and not exists (
    select 1 from item_images where item_images.item_id = items.id
  );

-- La columna vieja queda reemplazada por item_images.
alter table items drop column if exists image_url;
