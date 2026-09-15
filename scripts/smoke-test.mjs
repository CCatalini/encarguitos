import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv(new URL("../.env.local", import.meta.url).pathname);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const results = [];
const ok = (name, extra = "") => results.push(`OK   ${name}${extra ? " — " + extra : ""}`);
const fail = (name, err) => results.push(`FAIL ${name} — ${err?.message ?? err}`);

try {
  const { data: requesters, error: e1 } = await supabase.from("requesters").select("*").order("name");
  if (e1) fail("select requesters", e1);
  else ok("select requesters", `${requesters.length} filas (${requesters.map((r) => r.name).join(", ")})`);

  const cami = requesters?.find((r) => r.name === "Cami") ?? requesters?.[0];
  const { data: categories, error: e2 } = await supabase
    .from("categories")
    .select("*")
    .eq("requester_id", cami.id)
    .order("sort_order");
  if (e2) fail("select categories", e2);
  else ok("select categories", `${categories.length} filas (${categories.map((c) => c.name).join(", ")})`);

  const perfume = categories.find((c) => c.name === "Perfume") ?? categories[0];
  const { data: inserted, error: e3 } = await supabase
    .from("items")
    .insert({
      category_id: perfume.id,
      image_url: "https://example.com/prueba.jpg",
      brand: "Marca de prueba",
      comment: "Item de prueba automática — se borra solo",
      created_by: "test-script",
    })
    .select()
    .single();
  if (e3) fail("insert item", e3);
  else ok("insert item", `id ${inserted.id}`);

  const { data: updated, error: e4 } = await supabase
    .from("items")
    .update({ purchased: true })
    .eq("id", inserted.id)
    .select()
    .single();
  if (e4) fail("update item (purchased)", e4);
  else ok("update item (purchased)", `purchased=${updated.purchased}`);

  const { error: e5 } = await supabase.from("items").delete().eq("id", inserted.id);
  if (e5) fail("delete item", e5);
  else ok("delete item", "limpiado");

  const { data: bucketFiles, error: e6 } = await supabase.storage.from("item-photos").list();
  if (e6) fail("storage bucket item-photos", e6);
  else ok("storage bucket item-photos", `accesible, ${bucketFiles.length} archivos`);

  const channel = supabase.channel("smoke-test-realtime");
  const realtimeResult = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve("timeout (no se pudo confirmar en 5s)"), 5000);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {})
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve("SUBSCRIBED");
        }
      });
  });
  await supabase.removeChannel(channel);
  if (realtimeResult === "SUBSCRIBED") ok("realtime channel (items)", "suscripción OK");
  else fail("realtime channel (items)", realtimeResult);
} catch (err) {
  fail("excepción inesperada", err);
}

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
process.exit(failed ? 1 : 0);
