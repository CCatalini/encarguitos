"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Requester } from "@/lib/supabase/types";

export default function Home() {
  const [requesters, setRequesters] = useState<Requester[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("requesters")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRequesters(data);
      });
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            Catálogo de Viaje
          </h1>
          <p className="text-sm text-zinc-600">
            Todavía no está conectado a Supabase. Copiá{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5">
              .env.example
            </code>{" "}
            a{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5">
              .env.local
            </code>{" "}
            y completá los datos de tu proyecto (Project Settings → API en
            supabase.com). Después corré{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5">
              supabase/schema.sql
            </code>{" "}
            en el SQL Editor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold text-zinc-900">Catálogo de Viaje</h1>

      {error && (
        <p className="max-w-md text-center text-sm text-red-600">
          Error al leer Supabase: {error}
        </p>
      )}

      {!error && requesters === null && (
        <p className="text-sm text-zinc-500">Cargando…</p>
      )}

      {requesters && requesters.length === 0 && (
        <p className="max-w-md text-center text-sm text-zinc-600">
          Conectado a Supabase, pero la tabla{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5">requesters</code> está
          vacía. Corré <code className="rounded bg-zinc-100 px-1.5 py-0.5">
            supabase/schema.sql
          </code>{" "}
          en el SQL Editor para cargar los datos iniciales.
        </p>
      )}

      {requesters && requesters.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-zinc-600">
            Conectado ✓ — hijas en la base:
          </p>
          <div className="flex gap-3">
            {requesters.map((r) => (
              <span
                key={r.id}
                className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-800"
              >
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
