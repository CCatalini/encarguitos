-- Trip/Errand Catalog — initial schema
-- Run this once in the Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste and run).
--
-- If you already ran an earlier version of this file against a live
-- project, don't re-run the whole thing — use
-- supabase/migrations/002_requester_color.sql instead, it only adds
-- what's new (color column + policies) without touching existing data.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────

create table if not exists requesters (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    -- Tema de color elegido al crear el perfil (ver src/lib/theme.ts).
    -- El check evita valores que el frontend no sepa pintar.
    color text not null default 'green'
      check (color in ('green', 'pink', 'blue', 'amber', 'violet')),
    created_at timestamptz not null default now()
    );

create table if not exists categories (
                                          id uuid primary key default gen_random_uuid(),
    requester_id uuid not null references requesters(id) on delete cascade,
    name text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
    );

create table if not exists items (
                                     id uuid primary key default gen_random_uuid(),
    category_id uuid not null references categories(id) on delete cascade,
    image_url text,
    brand text,
    comment text,
    purchased boolean not null default false,
    sort_order integer not null default 0,
    created_by text,
    created_at timestamptz not null default now()
    );

create index if not exists categories_requester_id_idx on categories(requester_id);
create index if not exists items_category_id_idx on items(category_id);

-- ─────────────────────────────────────────────────────────
-- Seed data: two starter requesters + categories.
-- Cualquier persona nueva se crea desde la app (pantalla "Nueva
-- persona"), no hace falta tocar este archivo para eso.
-- ─────────────────────────────────────────────────────────

insert into requesters (name, color) values ('Cami', 'green'), ('Meli', 'pink')
    on conflict do nothing;

insert into categories (requester_id, name, sort_order)
select r.id, c.name, c.sort_order
from requesters r
         cross join (values
                         ('Perfume', 1),
                         ('Zapatillas', 2),
                         ('Ropa deportiva', 3),
                         ('Ropa común', 4),
                         ('Maquillaje', 5)
) as c(name, sort_order)
    on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- Row Level Security
--
-- There's no user login: access is controlled by the link
-- (unlisted) plus, optionally, a PIN validated in the app itself
-- before showing the UI. That's why the policies are open at the
-- database level — the real privacy comes from the link not being
-- shared publicly. If Supabase auth is added later, these policies
-- are the place to restrict them.
-- ─────────────────────────────────────────────────────────

alter table requesters enable row level security;
alter table categories enable row level security;
alter table items enable row level security;

create policy "requesters: public read" on requesters
  for select using (true);
create policy "requesters: public insert" on requesters
  for insert with check (true);
create policy "requesters: public update" on requesters
  for update using (true) with check (true);
create policy "requesters: public delete" on requesters
  for delete using (true);

create policy "categories: public read" on categories
  for select using (true);
create policy "categories: public insert" on categories
  for insert with check (true);
create policy "categories: public update" on categories
  for update using (true) with check (true);
create policy "categories: public delete" on categories
  for delete using (true);

create policy "items: public read" on items
  for select using (true);
create policy "items: public insert" on items
  for insert with check (true);
create policy "items: public update" on items
  for update using (true) with check (true);
create policy "items: public delete" on items
  for delete using (true);

-- ─────────────────────────────────────────────────────────
-- Realtime: so a new person, a new category, or "purchased"
-- sync instantly across everyone's phone.
-- ─────────────────────────────────────────────────────────

alter publication supabase_realtime add table requesters;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table items;

-- ─────────────────────────────────────────────────────────
-- Storage: bucket for photos taken from the phone
-- (in addition to pasting a URL from the internet, which needs no bucket).
-- ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
    on conflict (id) do nothing;

create policy "item-photos: public read"
  on storage.objects for select
                                    using (bucket_id = 'item-photos');

create policy "item-photos: public upload"
  on storage.objects for insert
  with check (bucket_id = 'item-photos');
