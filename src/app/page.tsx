"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Requester } from "@/lib/supabase/types";
import { themeOf } from "@/lib/theme";
import { CheckIcon, PencilIcon, TrashIcon } from "@/components/icons";

export default function Home() {
  const [requesters, setRequesters] = useState<Requester[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timeout = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timeout);
  }, [confirmDeleteId]);

  function startEditing(r: Requester) {
    setEditingId(r.id);
    setEditName(r.name);
    setConfirmDeleteId(null);
  }

  function submitEdit() {
    if (!editingId || !supabase) {
      setEditingId(null);
      return;
    }
    const trimmed = editName.trim();
    const id = editingId;
    setEditingId(null);
    if (!trimmed) return;

    const prev = requesters;
    setRequesters(
      (curr) => curr && curr.map((r) => (r.id === id ? { ...r, name: trimmed } : r))
    );
    supabase
      .from("requesters")
      .update({ name: trimmed })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setRequesters(prev);
          setError(error.message);
        }
      });
  }

  function handleTrashClick(id: string) {
    if (!supabase) return;
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);

    const prev = requesters;
    // Al borrar la persona se borran en cascada sus categorías e ítems
    // (ver supabase/schema.sql: "on delete cascade").
    setRequesters((curr) => curr && curr.filter((r) => r.id !== id));
    supabase
      .from("requesters")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setRequesters(prev);
          setError(error.message);
        }
      });
  }

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
            const isEditing = editingId === r.id;
            const isConfirmingDelete = confirmDeleteId === r.id;
            return (
              <div
                key={r.id}
                className="flex w-36 flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {isEditing ? (
                  <div className="flex flex-col items-center gap-3">
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold ${theme.avatarBg} ${theme.avatarText}`}
                    >
                      {r.name.charAt(0).toUpperCase()}
                    </span>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={submitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded-full border border-stone-300 px-3 py-1 text-center text-sm outline-none"
                    />
                  </div>
                ) : (
                  <Link
                    href={`/${r.id}`}
                    className="group flex flex-col items-center gap-3"
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
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEditing(r)}
                    aria-label="Editar nombre"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrashClick(r.id)}
                    aria-label={
                      isConfirmingDelete
                        ? "Confirmar borrado de persona"
                        : "Borrar persona"
                    }
                    className={`flex h-7 items-center justify-center gap-1 rounded-full px-2 transition ${
                      isConfirmingDelete
                        ? "bg-[#c53030] text-white hover:bg-[#b32d2d]"
                        : "text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                    }`}
                  >
                    {isConfirmingDelete ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      <TrashIcon className="h-3.5 w-3.5" />
                    )}
                    {isConfirmingDelete && (
                      <span className="text-xs font-bold">¿Seguro?</span>
                    )}
                  </button>
                </div>
              </div>
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
