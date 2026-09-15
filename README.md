## Encarguitos

Lo que le pedís a quien viaja, organizado por persona y por categoría. 

Encarguitos es una web app para coordinar encargos de viaje entre familia. Cada persona arma su propia lista dividida en categorías personalizables (perfume, zapatillas, ropa, maquillaje, lo que sea), y por cada cosa pedida puede sumar una imagen de referencia, la marca y un comentario opcional. Quien viaja abre una vista simple desde el celular y va tildando qué consiguió — con todo sincronizado al instante entre los dos lados, sin necesidad de crear cuenta ni instalar nada desde una store.

### Stack

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

### Poner esto a andar

#### 1. Instalar dependencias

```bash
npm install
```

### 4. Correrlo en local

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Si ves "Conectado ✓" con
los nombres, Supabase está bien configurado.

## Modelo de datos

| Tabla         | Campos clave                                                                          | Para qué                                  |
| ------------- | -------------------------------------------------------------------------------------- |-------------------------------------------|
| `requesters`  | `id`, `name`                                                                            | Separa las listas                         |
| `categories`  | `id`, `requester_id`, `name`, `sort_order`                                              | Categorías por persona, customizables     |
| `items`       | `id`, `category_id`, `image_url`, `brand`, `comment`, `purchased`, `created_by`         | Cada cosa pedida, con su estado de compra |


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
