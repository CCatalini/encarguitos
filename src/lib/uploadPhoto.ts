import { supabase } from "@/lib/supabase/client";

// Tamaño máximo aceptado para una foto subida desde la galería (5 MB).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Sube una foto al bucket público item-photos y devuelve su URL pública.
// La usan tanto el formulario de agregar ítem como el de editar la foto
// de uno ya cargado, así comparten la misma validación y el mismo bucket.
export async function uploadItemPhoto(file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase no está configurado.");

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("La foto pesa más de 5 MB. Probá con otra o achicala.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("item-photos")
    .upload(path, file, { contentType: file.type || undefined });

  if (error) throw new Error("No se pudo subir la foto. Probá de nuevo.");

  const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
  return data.publicUrl;
}
