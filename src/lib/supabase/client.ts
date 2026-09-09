import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cierto solo cuando .env.local tiene los dos valores del proyecto Supabase.
// La UI la usa para mostrar una pantalla de "falta configurar" en vez de
// romperse, algo importante en los primeros días del proyecto en los que
// todavía no existe un proyecto Supabase real.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Cliente para el navegador (las vistas "cargar" y "comprar" corren del lado
// del cliente para poder usar Realtime). La clave "anon" es pública por
// diseño: el acceso real lo controlan las políticas RLS de supabase/schema.sql.
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!)
  : null;
