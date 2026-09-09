-- Catálogo de Viaje — schema inicial
-- Correr esto una vez en el SQL Editor del proyecto de Supabase
-- (Dashboard → SQL Editor → New query → pegar y ejecutar).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────

create table if not exists hijas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  hija_id uuid not null references hijas(id) on delete cascade,
  nombre text not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias(id) on delete cascade,
  imagen_url text,
  marca text,
  comentario text,
  comprado boolean not null default false,
  creado_por text,
  creado_en timestamptz not null default now()
);

create index if not exists categorias_hija_id_idx on categorias(hija_id);
create index if not exists items_categoria_id_idx on items(categoria_id);

-- ─────────────────────────────────────────────────────────
-- Datos iniciales: las dos hijas + categorías de arranque
-- Editá los nombres y agregá/sacá categorías según haga falta.
-- ─────────────────────────────────────────────────────────

insert into hijas (nombre) values ('Cami'), ('Meli')
on conflict do nothing;

insert into categorias (hija_id, nombre, orden)
select h.id, c.nombre, c.orden
from hijas h
cross join (values
  ('Perfume', 1),
  ('Zapatillas', 2),
  ('Ropa deportiva', 3),
  ('Ropa común', 4),
  ('Maquillaje', 5)
) as c(nombre, orden)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- Row Level Security
--
-- No hay login de usuarios: el acceso se controla con el link
-- (no listado) más, opcionalmente, un PIN validado en la propia
-- app antes de mostrar la UI. Por eso las políticas son abiertas
-- a nivel de base — la privacidad real la da que el link no se
-- comparte públicamente. Si más adelante se agrega autenticación
-- de Supabase, estas políticas son el lugar para restringirlas.
-- ─────────────────────────────────────────────────────────

alter table hijas enable row level security;
alter table categorias enable row level security;
alter table items enable row level security;

create policy "hijas: lectura pública" on hijas
  for select using (true);

create policy "categorias: lectura pública" on categorias
  for select using (true);
create policy "categorias: alta pública" on categorias
  for insert with check (true);

create policy "items: lectura pública" on items
  for select using (true);
create policy "items: alta pública" on items
  for insert with check (true);
create policy "items: edición pública" on items
  for update using (true) with check (true);
create policy "items: borrado público" on items
  for delete using (true);

-- ─────────────────────────────────────────────────────────
-- Realtime: para que "comprado" se sincronice en el momento
-- entre el celular de mamá/papá y el de vos/Meli.
-- ─────────────────────────────────────────────────────────

alter publication supabase_realtime add table items;
alter publication supabase_realtime add table categorias;

-- ─────────────────────────────────────────────────────────
-- Storage: bucket para fotos sacadas desde el celular
-- (además de pegar una URL de internet, que no necesita bucket).
-- ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('item-fotos', 'item-fotos', true)
on conflict (id) do nothing;

create policy "item-fotos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'item-fotos');

create policy "item-fotos: subida pública"
  on storage.objects for insert
  with check (bucket_id = 'item-fotos');
