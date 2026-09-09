# Catálogo de Viaje

App para que Cami y Meli carguen, por categoría, lo que quieren que sus papás
les traigan de viaje — con imagen, marca y un comentario opcional — y para
que sus papás vayan marcando qué compraron desde el celular, sincronizado en
el momento.

Plan completo del proyecto (20 días, por fases): ver el documento de
planificación compartido en la conversación.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — Postgres, Realtime y Storage
- Deploy en [Vercel](https://vercel.com)

## Estado actual — Base técnica (días 1–5)

- [x] Proyecto Next.js con TypeScript y Tailwind
- [x] Cliente de Supabase tipado (`src/lib/supabase`)
- [x] Schema de base de datos con RLS y Realtime (`supabase/schema.sql`)
- [x] Página de inicio que confirma la conexión a Supabase
- [ ] Proyecto Supabase real creado (lo hacés vos, ver abajo)
- [ ] Deploy en Vercel

Lo que sigue (vistas para cargar y para comprar) es la fase 2 y 3 del plan.

## Poner esto a andar

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta gratis y un
   proyecto nuevo (elegí una región cercana, por ejemplo São Paulo).
2. Andá a **SQL Editor → New query**, pegá el contenido de
   [`supabase/schema.sql`](./supabase/schema.sql) y ejecutalo. Esto crea las
   tablas, las políticas de acceso, activa Realtime y deja cargadas las dos
   hijas más las categorías iniciales (Perfume, Zapatillas, Ropa deportiva,
   Ropa común, Maquillaje — se editan o agregan más después, desde la app o
   desde el SQL Editor).
3. Andá a **Project Settings → API** y copiá la **Project URL** y la clave
   **anon public**.

### 3. Configurar las variables de entorno

```bash
cp .env.example .env.local
```

Completá `.env.local` con la URL y la clave que copiaste en el paso anterior.

### 4. Correrlo en local

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Si ves "Conectado ✓" con
los nombres de las hijas, Supabase está bien configurado.

## Modelo de datos

| Tabla        | Campos clave                                                                    | Para qué                                  |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------ |
| `hijas`      | `id`, `nombre`                                                                    | Separa las dos listas                      |
| `categorias` | `id`, `hija_id`, `nombre`, `orden`                                                | Categorías por hija, customizables         |
| `items`      | `id`, `categoria_id`, `imagen_url`, `marca`, `comentario`, `comprado`, `creado_por` | Cada cosa pedida, con su estado de compra |

No hay login de usuarios: el acceso es por link no listado (se puede sumar un
PIN simple más adelante si hace falta más privacidad). Las políticas de
acceso (RLS) están en `supabase/schema.sql`.

## Deploy en Vercel

1. Subí este repo a GitHub.
2. En [vercel.com](https://vercel.com), **Add New → Project**, importá el
   repo.
3. En **Environment Variables**, cargá `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores de `.env.local`.
4. Deploy. Con eso ya queda una URL pública para compartir con tus papás.

Para que en Android quede como una app (y no como una pestaña de Chrome
perdida), desde el celular: abrir la URL en Chrome → menú (⋮) → **Agregar a
pantalla de inicio**. El manifest de PWA para que esto quede prolijo con
ícono propio se agrega en la fase 3 del plan.
