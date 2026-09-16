"use client";

import { use, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Category, Item, Requester } from "@/lib/supabase/types";
import { themeOf } from "@/lib/theme";
import { CheckIcon, ImageIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { uploadItemPhoto } from "@/lib/uploadPhoto";

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

  async function renameCategory(id: string, name: string) {
    if (!supabase) return;
    const prevName = categories.find((c) => c.id === id)?.name;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    const { error } = await supabase.from("categories").update({ name }).eq("id", id);
    if (error) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: prevName ?? c.name } : c))
      );
      setError(error.message);
    }
  }

  async function deleteCategory(id: string) {
    if (!supabase) return;
    const prevCategories = categories;
    const prevItems = items;
    const remaining = categories.filter((c) => c.id !== id);
    setCategories(remaining);
    setItems((prev) => prev.filter((i) => i.category_id !== id));
    setActiveCategoryId((current) =>
      current === id ? (remaining[0]?.id ?? null) : current
    );
    // Al borrar la categoría se borran en cascada sus ítems (ver
    // supabase/schema.sql: "on delete cascade").
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      setCategories(prevCategories);
      setItems(prevItems);
      setError(error.message);
    }
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

  async function updateItemImage(item: Item, imageUrl: string | null) {
    if (!supabase) return;
    const prevUrl = item.image_url;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, image_url: imageUrl } : i))
    );
    const { error } = await supabase
      .from("items")
      .update({ image_url: imageUrl })
      .eq("id", item.id);
    if (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, image_url: prevUrl } : i))
      );
      setError(error.message);
    }
  }

  async function updateItemText(
    item: Item,
    text: { brand: string | null; comment: string | null }
  ) {
    if (!supabase) return;
    const prev = { brand: item.brand, comment: item.comment };
    setItems((prevItems) =>
      prevItems.map((i) =>
        i.id === item.id ? { ...i, brand: text.brand, comment: text.comment } : i
      )
    );
    const { error } = await supabase
      .from("items")
      .update({ brand: text.brand, comment: text.comment })
      .eq("id", item.id);
    if (error) {
      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === item.id ? { ...i, brand: prev.brand, comment: prev.comment } : i
        )
      );
      setError(error.message);
    }
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
        onRename={renameCategory}
        onDelete={deleteCategory}
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
                onUpdateImage={(imageUrl) => updateItemImage(item, imageUrl)}
                onUpdateText={(text) => updateItemText(item, text)}
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
  onRename,
  onDelete,
  theme,
}: {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  theme: ReturnType<typeof themeOf>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmingDelete = confirmDeleteId !== null && confirmDeleteId === activeId;

  useEffect(() => {
    if (!confirmingDelete) return;
    const timeout = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timeout);
  }, [confirmingDelete]);

  function submit() {
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
    setName("");
    setAdding(false);
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setEditName(currentName);
    setConfirmDeleteId(null);
  }

  function submitEdit() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setEditName("");
  }

  function handleTrashClick() {
    if (!activeId) return;
    if (!confirmingDelete) {
      setConfirmDeleteId(activeId);
      return;
    }
    setConfirmDeleteId(null);
    onDelete(activeId);
  }

  const activeCategory = categories.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {categories.map((c) =>
          editingId === c.id ? (
            <input
              key={c.id}
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={submitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") {
                  setEditingId(null);
                  setEditName("");
                }
              }}
              className="w-40 shrink-0 rounded-full border border-stone-300 px-4 py-1.5 text-sm outline-none"
            />
          ) : (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                c.id === activeId ? theme.tabActive : theme.tabInactive
              }`}
            >
              {c.name}
            </button>
          )
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
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

        <button
          type="button"
          onClick={() => activeCategory && startEditing(activeCategory.id, activeCategory.name)}
          disabled={!activeCategory}
          aria-label="Editar categoría"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <PencilIcon />
        </button>

        <button
          type="button"
          onClick={handleTrashClick}
          disabled={!activeCategory}
          aria-label={confirmingDelete ? "Confirmar borrado de categoría" : "Borrar categoría"}
          className={`flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${
            confirmingDelete
              ? "bg-[#c53030] text-white hover:bg-[#b32d2d]"
              : "text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          }`}
        >
          {confirmingDelete ? <CheckIcon className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
          {confirmingDelete && <span className="text-xs font-bold">¿Seguro?</span>}
        </button>
      </div>
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
  onUpdateImage,
  onUpdateText,
}: {
  item: Item;
  theme: ReturnType<typeof themeOf>;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateImage: (imageUrl: string | null) => void;
  onUpdateText: (text: { brand: string | null; comment: string | null }) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  // 0 = cerrado, -SWIPE_REVEAL = deslizado (muestra el tacho).
  const [translate, setTranslate] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoEditOpen, setPhotoEditOpen] = useState(false);
  const [photoDraftUrl, setPhotoDraftUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [textEditOpen, setTextEditOpen] = useState(false);
  const [draftBrand, setDraftBrand] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const dragStartX = useRef<number | null>(null);
  const dragStartTranslate = useRef(0);
  const draggedRef = useRef(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => {
      setConfirming(false);
      setTranslate(0);
    }, 3500);
    return () => clearTimeout(timeout);
  }, [confirming]);

  // Foto ampliada: fondo oscurecido, se cierra tocando afuera o con Escape,
  // y bloquea el scroll de atrás mientras está abierta.
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen]);

  // Editar foto: mismo comportamiento de modal que la vista ampliada
  // (fondo oscurecido, Escape o tocar afuera para cerrar, sin scroll
  // de fondo).
  useEffect(() => {
    if (!photoEditOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPhotoEditOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [photoEditOpen]);

  function openPhotoEdit() {
    setPhotoDraftUrl(item.image_url ?? "");
    setPhotoUploadError(null);
    setPhotoEditOpen(true);
  }

  function savePhotoEdit() {
    const trimmed = photoDraftUrl.trim();
    onUpdateImage(trimmed || null);
    setPhotoEditOpen(false);
  }

  function removePhoto() {
    onUpdateImage(null);
    setPhotoEditOpen(false);
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    setPhotoUploadError(null);
    try {
      const url = await uploadItemPhoto(file);
      setPhotoDraftUrl(url);
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setPhotoUploading(false);
    }
  }

  // Editar producto/comentario: mismo modal de fondo oscurecido que la
  // foto (Escape o tocar afuera cierra, sin scroll de fondo).
  useEffect(() => {
    if (!textEditOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setTextEditOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [textEditOpen]);

  function openTextEdit() {
    setDraftBrand(item.brand ?? "");
    setDraftComment(item.comment ?? "");
    setTextEditOpen(true);
  }

  function saveTextEdit() {
    onUpdateText({
      brand: draftBrand.trim() || null,
      comment: draftComment.trim() || null,
    });
    setTextEditOpen(false);
  }

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
            confirming ? "bg-[#c53030]" : "bg-[#e5484d]"
          }`}
        >
          {confirming ? <CheckIcon className="h-7 w-7" /> : <TrashIcon className="h-7 w-7" />}
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
        className={`relative flex items-center gap-3 p-3 ${
          item.purchased ? "bg-stone-50" : "bg-white"
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

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              if (item.image_url && imgOk) setLightboxOpen(true);
            }}
            aria-label={item.image_url && imgOk ? "Ver imagen más grande" : undefined}
            disabled={!item.image_url || !imgOk}
            className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-stone-100 ${
              item.purchased ? "opacity-50" : ""
            }`}
          >
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
          </button>
          <button
            type="button"
            onClick={openPhotoEdit}
            aria-label={item.image_url ? "Cambiar o quitar la foto" : "Agregar una foto"}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm hover:text-stone-700"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={openTextEdit}
          aria-label="Editar producto y comentario"
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={`truncate text-sm font-medium ${
              item.purchased ? "text-stone-400 line-through" : "text-stone-800"
            }`}
          >
            {item.brand || "Sin producto"}
          </p>
          {item.comment && (
            <p className="truncate text-xs text-stone-500">{item.comment}</p>
          )}
        </button>

        <button
          onClick={onToggle}
          aria-label={item.purchased ? "Marcar pendiente" : "Marcar comprado"}
          aria-pressed={item.purchased}
          disabled={translate !== 0}
          style={{
            opacity: translate === 0 ? 1 : 0,
            transition: dragging ? "none" : "opacity 150ms ease",
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base ${
            item.purchased
              ? `${theme.accentBg} border-transparent text-white`
              : "border-stone-300 text-transparent hover:border-stone-400"
          }`}
        >
          ✓
        </button>
      </div>

      {lightboxOpen &&
        item.image_url &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={item.brand ?? "Imagen"}
            onClick={() => setLightboxOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image_url}
              alt={item.brand ?? ""}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            />
          </div>,
          document.body
        )}

      {photoEditOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editar foto"
            onClick={() => setPhotoEditOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-4 shadow-2xl"
            >
              <p className="text-sm font-medium text-stone-700">
                Foto de &quot;{item.brand || "este ítem"}&quot;
              </p>

              {photoDraftUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoDraftUrl}
                  alt=""
                  className="h-24 w-24 self-center rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}

              <input
                value={photoDraftUrl}
                onChange={(e) => setPhotoDraftUrl(e.target.value)}
                placeholder="Link de una imagen"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-400"
              />

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-stone-300" />
                <span className="text-xs text-stone-400">o</span>
                <div className="h-px flex-1 bg-stone-300" />
              </div>

              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoFileInputRef.current?.click()}
                disabled={photoUploading}
                className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
              >
                <ImageIcon className="h-4 w-4" />
                {photoUploading ? "Subiendo…" : "Elegir foto de la galería"}
              </button>
              {photoUploadError && (
                <p className="text-xs text-red-600">{photoUploadError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={savePhotoEdit}
                  disabled={photoUploading}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60 ${theme.accentBg} ${theme.accentBgHover}`}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoEditOpen(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-500"
                >
                  Cancelar
                </button>
              </div>

              {item.image_url && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>,
          document.body
        )}

      {textEditOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editar producto y comentario"
            onClick={() => setTextEditOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-4 shadow-2xl"
            >
              <p className="text-sm font-medium text-stone-700">Editar ítem</p>

              <input
                autoFocus
                value={draftBrand}
                onChange={(e) => setDraftBrand(e.target.value)}
                placeholder="Producto"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-400"
              />
              <textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder="Comentario (opcional) — talle, color, alguna aclaración"
                rows={2}
                className="resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-400"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveTextEdit}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white ${theme.accentBg} ${theme.accentBgHover}`}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setTextEditOpen(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim() && !imageUrl.trim()) return;
    onAdd({ image_url: imageUrl.trim(), brand: brand.trim(), comment: comment.trim() });
    setImageUrl("");
    setBrand("");
    setComment("");
    setUploadError(null);
    setOpen(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadItemPhoto(file);
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
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
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-stone-300" />
        <span className="text-xs text-stone-400">o</span>
        <div className="h-px flex-1 bg-stone-300" />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
      >
        <ImageIcon className="h-4 w-4" />
        {uploading ? "Subiendo…" : "Elegir foto de la galería"}
      </button>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
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
          disabled={uploading}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60 ${theme.accentBg} ${theme.accentBgHover}`}
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
