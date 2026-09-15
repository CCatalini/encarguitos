"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { THEMES, THEME_ORDER, type ThemeColor } from "@/lib/theme";

export default function NuevaPersonaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<ThemeColor>("green");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ponele un nombre.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("requesters")
      .insert({ name: trimmed, color })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(`/${data.id}`);
  }

  const theme = THEMES[color];

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-stone-50 px-8 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Nueva persona
        </h1>
        <p className="text-sm text-stone-500">
          Elegí un nombre y un color — vas a poder armar tus propias
          categorías después.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-stone-700">
            Nombre
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Tomi"
            autoFocus
            className={`rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:ring-2 ${theme.ring}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-stone-700">Color</span>
          <div className="flex flex-wrap gap-3">
            {THEME_ORDER.map((key) => {
              const t = THEMES[key];
              const selected = key === color;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={t.label}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition ${
                    selected ? "bg-stone-100" : "hover:bg-stone-50"
                  }`}
                >
                  <span
                    className={`h-9 w-9 rounded-full ${t.swatch} ${
                      selected
                        ? "ring-2 ring-offset-2 ring-stone-400"
                        : ""
                    }`}
                  />
                  <span className="text-xs text-stone-500">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${theme.accentBg} ${theme.accentBgHover}`}
        >
          {saving ? "Creando…" : "Crear"}
        </button>

        <Link
          href="/"
          className="text-center text-sm text-stone-400 hover:text-stone-600"
        >
          Cancelar
        </Link>
      </form>
    </main>
  );
}
