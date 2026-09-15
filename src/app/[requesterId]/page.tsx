"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Category, Item, Requester } from "@/lib/supabase/types";
import { themeOf } from "@/lib/theme";

type PageProps = {
  params: Promise<{ requesterId: string }>;
};

export default function RequesterPage({ params }: PageProps) {
  const { requesterId } = use(params);

  const [requester, setRequester] = useState<Requester | null | "not-found">(
    null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function load() {
      const { data: req, error: reqError } = await supabase!
        .from("requesters")
        .select("*")
        .eq("id", requesterId)
        .maybeSingle();

      if (cancelled) return;
      if (reqError) {
        setError(reqError.message);
        return;
      }
      if (!req) {
        setRequester("not-found");
        return;
      }
      setRequester(req);

      const { data: cats, error: catsError } = await supabase!
        .from("categories")
        .select("*")
        .eq("requester_id", requesterId)
        .order("sort_order");

      if (cancelled) return;
      if (catsError) {
        setError(catsError.message);
        return;
      }
      setCategories(cats ?? []);
      setActiveCategoryId((current) => current ?? cats?.[0]?.id ?? null);

      const categoryIds = (cats ?? []).map((c) => c.id);
      if (categoryIds.length === 0) {
        setItems([]);
        return;
      }

      const { data: its, error: itsError } = await supabase!
        .from("items")
        .select("*")
        .in("category_id", categoryIds)
        .order("sort_order")
        .order("created_at");

      if (cancelled) return;
      if (itsError) {
        setError(itsError.message);
        return;
      }
      setItems(its ?? []);
    }

    load();

    // Realtime: si vos y la otra persona (o tus papás) tienen esto
    // abierto a la vez, los cambios de una aparecen en la otra.
    const channel = supabase
      .channel(`requester-${requesterId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase?.removeChannel(channel);
    };
  }, [requesterId]);

  if (requester === "not-found") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-stone-50 px-8 py-16 text-center">
        <p className="text-stone-600">No encontramos a esa persona.</p>
        <Link href="/" className="text-sm text-stone-500 underline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center bg-stone-50 px-8 py-16">
        <p className="max-w-sm text-center text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!requester) {
    return (
      <main className="flex flex-1 items-center justify-center bg-stone-50 px-8 py-16">
        <p className="text-sm text-stone-400">Cargando…</p>
      </main>
    );
  }

  const theme = themeOf(requester.color);
  const activeCategory =
    categories.find((c) => c.id === activeCategoryId) ?? null;
  const activeItems = activeCategory
    ? items
        .filter((i) => i.category_id === activeCategory.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    : [];

  async function addCategory(name: string) {
    if (!supabase || !requester || requester === "not-found") return;
    const nextOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order)) + 1
        : 0;
    const { data, error } = await supabase
      .from("categories")
      .insert({ requester_id: requester.id, name, sort_order: nextOrder })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) => [...prev, data]);
    setActiveCategoryId(data.id);
  }

  async function addItem(input: {
    image_url: string;
    brand: string;
    comment: string;
  }) {
    if (!supabase || !activeCategory) return;
    const siblings = items.filter((i) => i.category_id === activeCategory.id);
    const nextOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((i) => i.sort_order)) + 1
        : 0;
    const { data, error } = await supabase
      .from("items")
      .insert({
        category_id: activeCategory.id,
        image_url: input.image_url || null,
        brand: input.brand || null,
        comment: input.comment || null,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setItems((prev) => [...prev, data]);
  }

  async function moveItem(item: Item, direction: "up" | "down") {
    if (!supabase) return;
    const siblings = items
      .filter((i) => i.category_id === item.category_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const index = siblings.findIndex((i) => i.id === item.id);
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= siblings.length) return;
    const neighbor = siblings[neighborIndex];

    // Swap sort_order between the two neighbors, optimistically.
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === item.id) return { ...i, sort_order: neighbor.sort_order };
        if (i.id === neighbor.id) return { ...i, sort_order: item.sort_order };
        return i;
      })
    );

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("items").update({ sort_order: neighbor.sort_order }).eq("id", item.id),
      supabase.from("items").update({ sort_order: item.sort_order }).eq("id", neighbor.id),
    ]);
    if (e1 || e2) {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) return { ...i, sort_order: item.sort_order };
          if (i.id === neighbor.id) return { ...i, sort_order: neighbor.sort_order };
          return i;
        })
      );
      setError((e1 ?? e2)!.message);
    }
  }

  async function togglePurchased(item: Item) {
    if (!supabase) return;
    const next = !item.purchased;
    const prevSortOrder = item.sort_order;

    // Al marcarlo comprado, lo mandamos al final de su categoría para
    // que la lista de "pendientes" quede arriba y ordenada.
    const siblings = items.filter((i) => i.category_id === item.category_id);
    const nextSortOrder = next
      ? Math.max(0, ...siblings.map((i) => i.sort_order)) + 1
      : prevSortOrder;

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, purchased: next, sort_order: nextSortOrder } : i
      )
    );
    const { error } = await supabase
      .from("items")
      .update({ purchased: next, sort_order: nextSortOrder })
      .eq("id", item.id);
    if (error) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, purchased: !next, sort_order: prevSortOrder } : i
        )
      );
      setError(error.message);
    }
  }

  async function deleteItem(item: Item) {
    if (!supabase) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) setError(error.message);
  }

  return (
    <main className="flex flex-1 flex-col bg-stone-50">
      <header
        className={`flex flex-col gap-4 rounded-b-3xl bg-gradient-to-br ${theme.headerFrom} ${theme.headerTo} px-6 pb-6 pt-5 text-white`}
      >
        <Link
          href="/"
          className="flex w-fit items-center gap-1 text-sm text-white/80 hover:text-white"
        >
          ← Encarguitos
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg font-semibold">
            {requester.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-semibold">{requester.name}</h1>
            <p className="text-sm text-white/75">
              {items.filter((i) => i.purchased).length} de {items.length}{" "}
              conseguido{items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </header>

      <CategoryTabs
        categories={categories}
        activeId={activeCategoryId}
        onSelect={setActiveCategoryId}
        onAdd={addCategory}
        theme={theme}
      />

      <div className="flex-1 px-4 pb-16 pt-4">
        {categories.length === 0 && (
          <p className="mt-10 text-center text-sm text-stone-400">
            Todavía no hay categorías. Creá la primera arriba (Perfume,
            Zapatillas, lo que sea).
          </p>
        )}

        {activeCategory && (
          <div className="mx-auto flex max-w-md flex-col gap-3">
            {activeItems.length === 0 && (
              <p className="py-8 text-center text-sm text-stone-400">
                Nada cargado en {activeCategory.name}.
              </p>
            )}

            {activeItems.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                theme={theme}
                isFirst={index === 0}
                isLast={index === activeItems.length - 1}
                onToggle={() => togglePurchased(item)}
                onDelete={() => deleteItem(item)}
                onMoveUp={() => moveItem(item, "up")}
                onMoveDown={() => moveItem(item, "down")}
              />
            ))}

            <AddItemForm theme={theme} onAdd={addItem} />
          </div>
        )}
      </div>
    </main>
  );
}

function CategoryTabs({
  categories,
  activeId,
  onSelect,
  onAdd,
  theme,
}: {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  theme: ReturnType<typeof themeOf>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-stone-200 bg-white px-4 py-3">
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            c.id === activeId ? theme.tabActive : theme.tabInactive
          }`}
        >
          {c.name}
        </button>
      ))}

      {adding ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setName("");
              setAdding(false);
            }
          }}
          placeholder="Nombre de la categoría"
          className="w-40 shrink-0 rounded-full border border-stone-300 px-4 py-1.5 text-sm outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-full border border-dashed border-stone-300 px-4 py-1.5 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-600"
        >
          + Categoría
        </button>
      )}
    </div>
  );
}

// Cuánto se desliza la fila para revelar el tacho (px).
const SWIPE_REVEAL = 88;
// Distancia mínima de arrastre horizontal para no confundir un tap con un swipe.
const SWIPE_DRAG_THRESHOLD = 6;

function ItemRow({
  item,
  theme,
  isFirst,
  isLast,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  theme: ReturnType<typeof themeOf>;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  // 0 = cerrado, -SWIPE_REVEAL = deslizado (muestra el tacho).
  const [translate, setTranslate] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartTranslate = useRef(0);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => {
      setConfirming(false);
      setTranslate(0);
    }, 3500);
    return () => clearTimeout(timeout);
  }, [confirming]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartX.current = e.clientX;
    dragStartTranslate.current = translate;
    draggedRef.current = false;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > SWIPE_DRAG_THRESHOLD) draggedRef.current = true;
    if (!draggedRef.current) return;
    setDragging(true);
    const next = Math.min(0, Math.max(-SWIPE_REVEAL, dragStartTranslate.current + dx));
    setTranslate(next);
  }

  function endDrag() {
    if (dragStartX.current === null) return;
    dragStartX.current = null;
    setDragging(false);
    if (draggedRef.current) {
      setTranslate((t) => (t < -SWIPE_REVEAL / 2 ? -SWIPE_REVEAL : 0));
    }
  }

  function handleFrontClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    // Después de un swipe, el navegador dispara igual un "click" al
    // soltar el dedo. Si no lo ignorábamos acá, ese click fantasma
    // volvía a cerrar la fila apenas se abría (no daba tiempo a tocar
    // el tacho). Lo consumimos una vez y recién el próximo toque
    // (sin arrastre) cuenta como "cerrar deslizando el dedo".
    if (draggedRef.current) {
      draggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Si estaba deslizada, un toque nuevo la cierra en vez de activar
    // lo que haya debajo (evita cerrar-y-tocar-otra-cosa sin querer).
    if (translate !== 0) {
      e.preventDefault();
      e.stopPropagation();
      setTranslate(0);
      setConfirming(false);
    }
  }

  function handleTrashTap() {
    if (confirming) {
      onDelete();
    } else {
      setConfirming(true);
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border shadow-sm ${theme.softBorder}`}>
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={handleTrashTap}
          aria-label={confirming ? "Confirmar borrado" : "Borrar (deslizado)"}
          style={{ width: SWIPE_REVEAL }}
          className={`flex flex-col items-center justify-center gap-1 text-white transition-colors ${
            confirming ? "bg-[#c1443f]" : "bg-[#d3615c]"
          }`}
        >
          {confirming ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          )}
          <span className="text-sm font-bold">{confirming ? "¿Seguro?" : "Borrar"}</span>
        </button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleFrontClickCapture}
        style={{
          transform: `translateX(${translate}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
          touchAction: "pan-y",
        }}
        className={`relative flex items-center gap-3 bg-white p-3 ${
          item.purchased ? "opacity-60" : ""
        }`}
      >
        <div className="flex shrink-0 flex-col">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Subir"
            className="flex h-5 w-5 items-center justify-center text-stone-300 hover:text-stone-600 disabled:opacity-0"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Bajar"
            className="flex h-5 w-5 items-center justify-center text-stone-300 hover:text-stone-600 disabled:opacity-0"
          >
            ▼
          </button>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100">
          {item.image_url && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.brand ?? ""}
              className="h-full w-full object-cover"
              onError={() => setImgOk(false)}
            />
          ) : (
            <span className="text-lg text-stone-300">···</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium text-stone-800 ${
              item.purchased ? "line-through" : ""
            }`}
          >
            {item.brand || "Sin producto"}
          </p>
          {item.comment && (
            <p className="truncate text-xs text-stone-500">{item.comment}</p>
          )}
        </div>

        <button
          onClick={onToggle}
          aria-label={item.purchased ? "Marcar pendiente" : "Marcar comprado"}
          aria-pressed={item.purchased}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base transition ${
            item.purchased
              ? `${theme.accentBg} border-transparent text-white`
              : "border-stone-300 text-transparent hover:border-stone-400"
          }`}
        >
          ✓
        </button>
      </div>
    </div>
  );
}

function AddItemForm({
  theme,
  onAdd,
}: {
  theme: ReturnType<typeof themeOf>;
  onAdd: (input: { image_url: string; brand: string; comment: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [comment, setComment] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim() && !imageUrl.trim()) return;
    onAdd({ image_url: imageUrl.trim(), brand: brand.trim(), comment: comment.trim() });
    setImageUrl("");
    setBrand("");
    setComment("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`mt-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium ${theme.softBorder} ${theme.accentText} hover:${theme.soft}`}
      >
        + Agregar algo
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`mt-2 flex flex-col gap-3 rounded-xl border p-4 ${theme.soft} ${theme.softBorder}`}
    >
      <input
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="Producto"
        autoFocus
        className={`rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 ${theme.ring}`}
      />
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-24 w-24 self-center rounded-lg object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="Link de una imagen (opcional)"
        className={`rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 ${theme.ring}`}
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario (opcional) — talle, color, alguna aclaración"
        rows={2}
        className={`resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 ${theme.ring}`}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white ${theme.accentBg} ${theme.accentBgHover}`}
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-500"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
