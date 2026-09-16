import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

// Mismo cargador casero de .env.local que scripts/smoke-test.mjs, para no
// sumar una dependencia (dotenv) solo para los tests. En CI las variables
// llegan por el entorno del proceso, así que .env.local es opcional ahí.
function loadEnvFile(): Record<string, string> {
  const envPath = path.join(__dirname, "..", ".env.local");
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) out[match[1]] = match[2].trim();
    }
  } catch {
    // No hay .env.local — normal en CI si las variables ya están seteadas.
  }
  return out;
}

const fileEnv = loadEnvFile();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "(en .env.local o como variables de entorno) para correr los tests e2e."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Crea una persona y una categoría descartables para cada test, en vez de
// tocar datos reales de la app (Cami, Meli, etc.) — se borran solas al
// terminar. El nombre lleva el prefijo "QA E2E" y la hora para que, si algo
// queda pegado por un test que falló, sea fácil de identificar y limpiar
// a mano desde Supabase.
export async function createTestRequester(namePrefix: string) {
  const name = `${namePrefix} ${Date.now()}`;
  const { data: requester, error: reqError } = await supabase
    .from("requesters")
    .insert({ name, color: "green" })
    .select()
    .single();
  if (reqError || !requester) {
    throw reqError ?? new Error("No se pudo crear la persona de prueba");
  }

  const { data: category, error: catError } = await supabase
    .from("categories")
    .insert({ requester_id: requester.id, name: "Categoría de prueba", sort_order: 0 })
    .select()
    .single();
  if (catError || !category) {
    throw catError ?? new Error("No se pudo crear la categoría de prueba");
  }

  return { requester, category };
}

// Borra en cascada la persona, su categoría y sus ítems (ver
// supabase/schema.sql: "on delete cascade" en categories/items).
export async function deleteTestRequester(requesterId: string) {
  await supabase.from("requesters").delete().eq("id", requesterId);
}
