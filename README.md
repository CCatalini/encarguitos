# Encarguitos

Lo que le pedís a quien viaja, organizado por persona y por categoría.

Cada persona arma su propia lista dividida en categorías personalizables (perfume, zapatillas, ropa, maquillaje, lo que sea), con imagen de referencia, marca y un comentario opcional por cada cosa pedida. Quien viaja abre la lista desde el celular y va tildando qué consiguió, sincronizado al instante entre todos — sin cuentas ni instalación.

Cada persona elige un color al crear su perfil (verde, rosa, celeste, ámbar o violeta) y su vista entera se pinta con esa paleta.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — Postgres, Realtime y Storage
- Deploy en [Vercel](https://vercel.com)

## Modelo de datos

| Tabla        | Campos clave                                                             | Para qué                              |
| ------------ | ------------------------------------------------------------------------- | -------------------------------------- |
| `requesters` | `id`, `name`, `color`                                                     | Una fila por persona, con su tema      |
| `categories` | `id`, `requester_id`, `name`, `sort_order`                                | Categorías por persona                 |
| `items`      | `id`, `category_id`, `image_url`, `brand`, `comment`, `purchased`         | Cada cosa pedida y su estado de compra |

No hay login: el acceso es por link no listado. Las políticas de acceso (RLS) están en `supabase/schema.sql`.

## Correr el proyecto en local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear un proyecto en [supabase.com](https://supabase.com) y correr `supabase/schema.sql` en el SQL Editor (Dashboard → SQL Editor → New query). Esto crea las tablas, las políticas, activa Realtime y deja cargados los datos iniciales.

3. Copiar `.env.example` a `.env.local` y completar con la Project URL y la clave `anon public` del proyecto (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

4. Levantar el server de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000).

## Deploy

1. Importar el repo en [Vercel](https://vercel.com).
2. Cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variables de entorno.
3. Deploy.

Desde el celular, para que quede como una app (Android): abrir la URL en Chrome → menú (⋮) → **Agregar a pantalla de inicio**.
