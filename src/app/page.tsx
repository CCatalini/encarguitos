"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Requester } from "@/lib/supabase/types";

const AVATAR_COLORS = [
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800",
];

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
      <Shell>
        <p className="max-w-sm text-center text-sm text-stone-600">
          Todavía no está conectado a Supabase. Copiá{" "}
          <Code>.env.example</Code> a <Code>.env.local</Code> y completá los
          datos de tu proyecto (Project Settings → API en supabase.com).
          Después corré <Code>supabase/schema.sql</Code> en el SQL Editor.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {error && (
        <p className="max-w-sm text-center text-sm text-red-600">
          Error al leer Supabase: {error}
        </p>
      )}

      {!error && requesters === null && (
        <p className="text-sm text-stone-400">Cargando…</p>
      )}

      {requesters && requesters.length === 0 && (
        <p className="max-w-sm text-center text-sm text-stone-600">
          Conectado a Supabase, pero la tabla <Code>requesters</Code> está
          vacía. Corré <Code>supabase/schema.sql</Code> en el SQL Editor para
          cargar los datos iniciales.
        </p>
      )}

      {requesters && requesters.length > 0 && (
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {requesters.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className="group flex w-36 flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold ${
                  AVATAR_COLORS[i % AVATAR_COLORS.length]
                }`}
              >
                {r.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-stone-800">
                {r.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-stone-50 px-8 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Encarguitos
        </h1>
        <p className="text-sm text-stone-500">
          Lo que le pedís a quien viaja, en un solo lugar.
        </p>
      </div>
      {children}
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-700">
      {children}
    </code>
  );
}
