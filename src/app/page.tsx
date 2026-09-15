"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Requester } from "@/lib/supabase/types";
import { themeOf } from "@/lib/theme";

export default function Home() {
  const [requesters, setRequesters] = useState<Requester[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const load = () =>
      supabase!
        .from("requesters")
        .select("*")
        .order("name")
        .then(({ data, error }) => {
          if (error) setError(error.message);
          else setRequesters(data);
        });

    load();

    // Si alguien crea una persona nueva desde otro celular, aparece acá
    // sin necesidad de recargar la página.
    const channel = supabase
      .channel("home-requesters")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requesters" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
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

      {requesters && (
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {requesters.map((r) => {
            const theme = themeOf(r.color);
            return (
              <Link
                key={r.id}
                href={`/${r.id}`}
                className="group flex w-36 flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold ${theme.avatarBg} ${theme.avatarText}`}
                >
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-stone-800">
                  {r.name}
                </span>
              </Link>
            );
          })}

          <Link
            href="/nuevo"
            className="flex w-36 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 px-5 py-6 text-stone-400 transition hover:-translate-y-0.5 hover:border-stone-400 hover:text-stone-600"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-stone-300 text-2xl leading-none">
              +
            </span>
            <span className="text-sm font-medium">Nueva persona</span>
          </Link>
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
