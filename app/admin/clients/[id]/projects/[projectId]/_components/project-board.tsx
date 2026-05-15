"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, ConfirmDialog, Hairline, StatusBadge } from "@/lib/ds";
import {
  CUSTOM_TEMPLATE_ID,
  RAW_HTML_VIRTUAL_TEMPLATE_ID,
  getPageTemplate,
} from "@/lib/page-templates";
import {
  createProjectLot,
  deleteProjectLot,
  renameProjectLot,
  reorderProjectContexts,
  reorderProjectLots,
  reorderProjectPages,
  setContextLot,
  setPageLot,
} from "../actions";
import { DetachPageButton } from "./detach-page-button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardLot = {
  id: string;
  name: string | null;
  position: number;
};

export type BoardPage = {
  id: string;
  name: string;
  slug: string;
  template_id: string;
  position: number;
  is_published: boolean;
  created_at: string;
  lot_id: string | null;
};

export type BoardNote = {
  id: string;
  title: string;
  slug: string;
  position: number;
  is_published: boolean;
  source_kind: "upload" | "url" | "empty";
  created_at: string;
  lot_id: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function lotLabel(lot: BoardLot, index: number): string {
  const base = `Lot ${index + 1}`;
  return lot.name ? `${base} · ${lot.name}` : base;
}

// ---------------------------------------------------------------------------
// Main board
// ---------------------------------------------------------------------------

export function ProjectBoard({
  profileId,
  projectId,
  initialLots,
  initialPages,
  initialNotes,
  dbTemplateLabels,
}: {
  profileId: string;
  projectId: string;
  initialLots: BoardLot[];
  initialPages: BoardPage[];
  initialNotes: BoardNote[];
  dbTemplateLabels: Record<string, string>;
}) {
  const [lots, setLots] = useState<BoardLot[]>(initialLots);
  const [pages, setPages] = useState<BoardPage[]>(initialPages);
  const [notes, setNotes] = useState<BoardNote[]>(initialNotes);
  const [error, setError] = useState<string | null>(null);

  // Resync sur re-fetch parent (router.refresh, navigation, suppression…).
  useEffect(() => setLots(initialLots), [initialLots]);
  useEffect(() => setPages(initialPages), [initialPages]);
  useEffect(() => setNotes(initialNotes), [initialNotes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Order utility : (lot.position, item.position) pour rendre le board en
  // sections cohérentes. Les items orphelins (lot_id null) sont en fin.
  const lotIndex = useMemo(() => {
    const map = new Map<string, number>();
    lots.forEach((l, i) => map.set(l.id, i));
    return map;
  }, [lots]);

  function buildDisplayOrderedPages(pagesIn: BoardPage[]): BoardPage[] {
    return [...pagesIn].sort((a, b) => {
      const ai = a.lot_id ? (lotIndex.get(a.lot_id) ?? Infinity) : Infinity;
      const bi = b.lot_id ? (lotIndex.get(b.lot_id) ?? Infinity) : Infinity;
      if (ai !== bi) return ai - bi;
      return a.position - b.position;
    });
  }

  function buildDisplayOrderedNotes(notesIn: BoardNote[]): BoardNote[] {
    return [...notesIn].sort((a, b) => {
      const ai = a.lot_id ? (lotIndex.get(a.lot_id) ?? Infinity) : Infinity;
      const bi = b.lot_id ? (lotIndex.get(b.lot_id) ?? Infinity) : Infinity;
      if (ai !== bi) return ai - bi;
      return a.position - b.position;
    });
  }

  // ---- Drag handlers ----

  function handleLotDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lots.findIndex((l) => l.id === active.id);
    const newIndex = lots.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = lots;
    const reordered = arrayMove(lots, oldIndex, newIndex);
    setLots(reordered);
    setError(null);
    startTransition(async () => {
      const res = await reorderProjectLots({
        profileId,
        projectId,
        lotIds: reordered.map((l) => l.id),
      });
      if (!res.ok) {
        setError(res.error);
        setLots(previous);
      }
    });
  }

  function handlePagesDragEndForLot(
    lotId: string | null,
    event: DragEndEvent,
  ) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sectionPages = pages
      .filter((p) => (p.lot_id ?? null) === lotId)
      .sort((a, b) => a.position - b.position);
    const oldIndex = sectionPages.findIndex((p) => p.id === active.id);
    const newIndex = sectionPages.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedSection = arrayMove(sectionPages, oldIndex, newIndex);

    // Reconstruit la liste globale dans l'ordre d'affichage : lots dans
    // leur ordre, puis pour chaque lot ses pages (avec la nouvelle perm
    // pour le lot affecté), puis les pages orphelines.
    const buckets = new Map<string | null, BoardPage[]>();
    for (const lot of lots) buckets.set(lot.id, []);
    buckets.set(null, []);
    for (const p of pages) {
      const key = p.lot_id ?? null;
      if (key === lotId) continue;
      const arr = buckets.get(key);
      if (arr) arr.push(p);
    }
    buckets.set(lotId, reorderedSection);

    const globalOrdered: BoardPage[] = [];
    for (const lot of lots) {
      const arr = buckets.get(lot.id) ?? [];
      arr.sort((a, b) => a.position - b.position);
      globalOrdered.push(...arr);
    }
    const orphans = (buckets.get(null) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    globalOrdered.push(...orphans);

    // Renumérote la position localement
    const renumbered = globalOrdered.map((p, i) => ({ ...p, position: i }));
    const previous = pages;
    setPages(renumbered);
    setError(null);
    startTransition(async () => {
      const res = await reorderProjectPages({
        profileId,
        projectId,
        pageIds: renumbered.map((p) => p.id),
      });
      if (!res.ok) {
        setError(res.error);
        setPages(previous);
      }
    });
  }

  function handleNotesDragEndForLot(
    lotId: string | null,
    event: DragEndEvent,
  ) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sectionNotes = notes
      .filter((n) => (n.lot_id ?? null) === lotId)
      .sort((a, b) => a.position - b.position);
    const oldIndex = sectionNotes.findIndex((n) => n.id === active.id);
    const newIndex = sectionNotes.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedSection = arrayMove(sectionNotes, oldIndex, newIndex);

    const buckets = new Map<string | null, BoardNote[]>();
    for (const lot of lots) buckets.set(lot.id, []);
    buckets.set(null, []);
    for (const n of notes) {
      const key = n.lot_id ?? null;
      if (key === lotId) continue;
      const arr = buckets.get(key);
      if (arr) arr.push(n);
    }
    buckets.set(lotId, reorderedSection);

    const globalOrdered: BoardNote[] = [];
    for (const lot of lots) {
      const arr = buckets.get(lot.id) ?? [];
      arr.sort((a, b) => a.position - b.position);
      globalOrdered.push(...arr);
    }
    const orphans = (buckets.get(null) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    globalOrdered.push(...orphans);

    const renumbered = globalOrdered.map((n, i) => ({ ...n, position: i }));
    const previous = notes;
    setNotes(renumbered);
    setError(null);
    startTransition(async () => {
      const res = await reorderProjectContexts({
        profileId,
        projectId,
        contextIds: renumbered.map((n) => n.id),
      });
      if (!res.ok) {
        setError(res.error);
        setNotes(previous);
      }
    });
  }

  // ---- Lot CRUD ----

  function handleCreateLot(name: string | null) {
    const previous = lots;
    setError(null);
    startTransition(async () => {
      const res = await createProjectLot({ profileId, projectId, name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const newLot: BoardLot = {
        id: res.lotId,
        name,
        position: previous.length,
      };
      setLots([...previous, newLot]);
    });
  }

  function handleRenameLot(lotId: string, name: string | null) {
    const previous = lots;
    setLots(previous.map((l) => (l.id === lotId ? { ...l, name } : l)));
    setError(null);
    startTransition(async () => {
      const res = await renameProjectLot({
        profileId,
        projectId,
        lotId,
        name,
      });
      if (!res.ok) {
        setError(res.error);
        setLots(previous);
      }
    });
  }

  function handleDeleteLot(lotId: string) {
    const previous = lots;
    const previousPages = pages;
    const previousNotes = notes;
    setLots(previous.filter((l) => l.id !== lotId));
    setPages(pages.map((p) => (p.lot_id === lotId ? { ...p, lot_id: null } : p)));
    setNotes(notes.map((n) => (n.lot_id === lotId ? { ...n, lot_id: null } : n)));
    setError(null);
    startTransition(async () => {
      const res = await deleteProjectLot({ profileId, projectId, lotId });
      if (!res.ok) {
        setError(res.error);
        setLots(previous);
        setPages(previousPages);
        setNotes(previousNotes);
      }
    });
  }

  // ---- Item → lot move ----

  function handlePageLotChange(pageId: string, lotId: string | null) {
    const previous = pages;
    setPages(pages.map((p) => (p.id === pageId ? { ...p, lot_id: lotId } : p)));
    setError(null);
    startTransition(async () => {
      const res = await setPageLot({ profileId, projectId, pageId, lotId });
      if (!res.ok) {
        setError(res.error);
        setPages(previous);
      }
    });
  }

  function handleNoteLotChange(noteId: string, lotId: string | null) {
    const previous = notes;
    setNotes(
      notes.map((n) => (n.id === noteId ? { ...n, lot_id: lotId } : n)),
    );
    setError(null);
    startTransition(async () => {
      const res = await setContextLot({
        profileId,
        projectId,
        contextId: noteId,
        lotId,
      });
      if (!res.ok) {
        setError(res.error);
        setNotes(previous);
      }
    });
  }

  // ---- Rendering ----

  const orderedPages = buildDisplayOrderedPages(pages);
  const orderedNotes = buildDisplayOrderedNotes(notes);

  return (
    <div className="flex flex-col gap-10">
      {error && (
        <p className="border-l-2 border-red-400/40 pl-4 text-[11px] uppercase tracking-[0.32em] text-red-300/80">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleLotDragEnd}
      >
        <SortableContext
          items={lots.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-10">
            {lots.map((lot, index) => (
              <SortableLotSection
                key={lot.id}
                lot={lot}
                index={index}
                lots={lots}
                pages={orderedPages.filter((p) => p.lot_id === lot.id)}
                notes={orderedNotes.filter((n) => n.lot_id === lot.id)}
                profileId={profileId}
                projectId={projectId}
                dbTemplateLabels={dbTemplateLabels}
                sensors={sensors}
                onRename={handleRenameLot}
                onDelete={handleDeleteLot}
                onPagesDragEnd={(event) => handlePagesDragEndForLot(lot.id, event)}
                onNotesDragEnd={(event) => handleNotesDragEndForLot(lot.id, event)}
                onPageLotChange={handlePageLotChange}
                onNoteLotChange={handleNoteLotChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <OrphanSection
        lots={lots}
        pages={orderedPages.filter((p) => p.lot_id === null)}
        notes={orderedNotes.filter((n) => n.lot_id === null)}
        profileId={profileId}
        projectId={projectId}
        dbTemplateLabels={dbTemplateLabels}
        sensors={sensors}
        onPagesDragEnd={(event) => handlePagesDragEndForLot(null, event)}
        onNotesDragEnd={(event) => handleNotesDragEndForLot(null, event)}
        onPageLotChange={handlePageLotChange}
        onNoteLotChange={handleNoteLotChange}
      />

      <CreateLotForm onCreate={handleCreateLot} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lot section (sortable card containing pages + notes lists)
// ---------------------------------------------------------------------------

function SortableLotSection({
  lot,
  index,
  lots,
  pages,
  notes,
  profileId,
  projectId,
  dbTemplateLabels,
  sensors,
  onRename,
  onDelete,
  onPagesDragEnd,
  onNotesDragEnd,
  onPageLotChange,
  onNoteLotChange,
}: {
  lot: BoardLot;
  index: number;
  lots: BoardLot[];
  pages: BoardPage[];
  notes: BoardNote[];
  profileId: string;
  projectId: string;
  dbTemplateLabels: Record<string, string>;
  sensors: ReturnType<typeof useSensors>;
  onRename: (lotId: string, name: string | null) => void;
  onDelete: (lotId: string) => void;
  onPagesDragEnd: (event: DragEndEvent) => void;
  onNotesDragEnd: (event: DragEndEvent) => void;
  onPageLotChange: (pageId: string, lotId: string | null) => void;
  onNoteLotChange: (noteId: string, lotId: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lot.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameDraft, setNameDraft] = useState(lot.name ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setNameDraft(lot.name ?? ""), [lot.name]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    const trimmed = nameDraft.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    setEditing(false);
    if ((lot.name ?? null) !== next) {
      onRename(lot.id, next);
    }
  }

  const label = lotLabel(lot, index);

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 ${
        isDragging ? "z-10 opacity-60" : ""
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            aria-label={`Réordonner ${label}`}
            className="flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-white/30 transition-colors hover:text-white/70 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <DragDots />
          </button>

          {editing ? (
            <input
              ref={inputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setNameDraft(lot.name ?? "");
                  setEditing(false);
                }
              }}
              placeholder="Nom optionnel"
              maxLength={80}
              className="min-w-0 flex-1 border-b border-white/30 bg-transparent pb-1 font-sans text-base font-light text-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-w-0 flex-1 text-left text-base font-light text-[#F5F5F7] transition-colors hover:text-white"
              title="Cliquer pour renommer"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/40">
                Lot {String(index + 1).padStart(2, "0")}
              </span>
              {lot.name && (
                <span className="ml-3 font-sans">
                  · {lot.name}
                </span>
              )}
              {!lot.name && (
                <span className="ml-3 font-serif italic text-white/30">
                  + ajouter un nom
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-red-300/80"
          >
            Supprimer
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-6 pl-8">
        <ItemList
          kind="pages"
          items={pages.map((p) => ({
            id: p.id,
            lot_id: p.lot_id,
            render: (sortable) => (
              <SortablePageRow
                key={p.id}
                page={p}
                lots={lots}
                profileId={profileId}
                projectId={projectId}
                dbTemplateLabel={dbTemplateLabels[p.template_id]}
                onLotChange={onPageLotChange}
                sortable={sortable}
              />
            ),
          }))}
          sensors={sensors}
          onDragEnd={onPagesDragEnd}
          emptyLabel={notes.length === 0 ? "Aucun élément dans ce lot." : null}
        />

        {notes.length > 0 && pages.length > 0 && (
          <div className="h-px bg-white/5" />
        )}

        <ItemList
          kind="notes"
          items={notes.map((n) => ({
            id: n.id,
            lot_id: n.lot_id,
            render: (sortable) => (
              <SortableNoteRow
                key={n.id}
                note={n}
                lots={lots}
                profileId={profileId}
                onLotChange={onNoteLotChange}
                sortable={sortable}
              />
            ),
          }))}
          sensors={sensors}
          onDragEnd={onNotesDragEnd}
          emptyLabel={null}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title={`Supprimer ${label} ?`}
        description={
          pages.length + notes.length > 0
            ? `Les ${pages.length + notes.length} élément${
                pages.length + notes.length > 1 ? "s" : ""
              } rattaché${
                pages.length + notes.length > 1 ? "s" : ""
              } repasseront en « Hors lot » — rien n'est supprimé.`
            : "Aucun élément n'y est rattaché — la suppression est sans effet collatéral."
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(lot.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Orphan section (items not in any lot)
// ---------------------------------------------------------------------------

function OrphanSection({
  lots,
  pages,
  notes,
  profileId,
  projectId,
  dbTemplateLabels,
  sensors,
  onPagesDragEnd,
  onNotesDragEnd,
  onPageLotChange,
  onNoteLotChange,
}: {
  lots: BoardLot[];
  pages: BoardPage[];
  notes: BoardNote[];
  profileId: string;
  projectId: string;
  dbTemplateLabels: Record<string, string>;
  sensors: ReturnType<typeof useSensors>;
  onPagesDragEnd: (event: DragEndEvent) => void;
  onNotesDragEnd: (event: DragEndEvent) => void;
  onPageLotChange: (pageId: string, lotId: string | null) => void;
  onNoteLotChange: (noteId: string, lotId: string | null) => void;
}) {
  if (pages.length === 0 && notes.length === 0) return null;

  return (
    <section className="flex flex-col gap-5 border-t border-white/10 pt-8">
      <header className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/40">
          Hors lot
        </span>
        <span className="text-[11px] uppercase tracking-[0.32em] text-white/25">
          {pages.length + notes.length} élément
          {pages.length + notes.length > 1 ? "s" : ""}
        </span>
      </header>

      <div className="flex flex-col gap-6 pl-8">
        <ItemList
          kind="pages"
          items={pages.map((p) => ({
            id: p.id,
            lot_id: p.lot_id,
            render: (sortable) => (
              <SortablePageRow
                key={p.id}
                page={p}
                lots={lots}
                profileId={profileId}
                projectId={projectId}
                dbTemplateLabel={dbTemplateLabels[p.template_id]}
                onLotChange={onPageLotChange}
                sortable={sortable}
              />
            ),
          }))}
          sensors={sensors}
          onDragEnd={onPagesDragEnd}
          emptyLabel={null}
        />

        {notes.length > 0 && pages.length > 0 && (
          <div className="h-px bg-white/5" />
        )}

        <ItemList
          kind="notes"
          items={notes.map((n) => ({
            id: n.id,
            lot_id: n.lot_id,
            render: (sortable) => (
              <SortableNoteRow
                key={n.id}
                note={n}
                lots={lots}
                profileId={profileId}
                onLotChange={onNoteLotChange}
                sortable={sortable}
              />
            ),
          }))}
          sensors={sensors}
          onDragEnd={onNotesDragEnd}
          emptyLabel={null}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Generic sortable list of items (pages OR notes)
// ---------------------------------------------------------------------------

type SortableRenderArg = {
  setNodeRef: (el: HTMLElement | null) => void;
  style: React.CSSProperties;
  attributes: React.HTMLAttributes<HTMLElement>;
  listeners: Record<string, (event: React.SyntheticEvent) => void> | undefined;
  isDragging: boolean;
};

function ItemList({
  items,
  sensors,
  onDragEnd,
  emptyLabel,
}: {
  kind: "pages" | "notes";
  items: Array<{
    id: string;
    lot_id: string | null;
    render: (sortable: SortableRenderArg) => React.ReactNode;
  }>;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  emptyLabel: string | null;
}) {
  if (items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <p className="font-serif text-sm italic text-white/30">{emptyLabel}</p>
    );
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((it) => it.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col">
          {items.map((it) => (
            <SortableShell key={it.id} id={it.id}>
              {(sortable) => it.render(sortable)}
            </SortableShell>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableShell({
  id,
  children,
}: {
  id: string;
  children: (sortable: SortableRenderArg) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <>
      {children({
        setNodeRef,
        style,
        attributes,
        listeners: listeners as
          | Record<string, (event: React.SyntheticEvent) => void>
          | undefined,
        isDragging,
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page row
// ---------------------------------------------------------------------------

function SortablePageRow({
  page,
  lots,
  profileId,
  projectId,
  dbTemplateLabel,
  onLotChange,
  sortable,
}: {
  page: BoardPage;
  lots: BoardLot[];
  profileId: string;
  projectId: string;
  dbTemplateLabel: string | undefined;
  onLotChange: (pageId: string, lotId: string | null) => void;
  sortable: SortableRenderArg;
}) {
  const codeTemplate = getPageTemplate(page.template_id);
  const isDetached = page.template_id === CUSTOM_TEMPLATE_ID;
  const isRawHtmlDirect = page.template_id === RAW_HTML_VIRTUAL_TEMPLATE_ID;
  const templateLabel = isDetached
    ? "Détachée"
    : isRawHtmlDirect
      ? "Reproduction fidèle"
      : (codeTemplate?.label ?? dbTemplateLabel ?? null);

  return (
    <li
      ref={sortable.setNodeRef as (el: HTMLLIElement | null) => void}
      style={sortable.style}
      className={`flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-white/5 py-5 last:border-b-0 ${
        sortable.isDragging ? "z-10 bg-white/[0.02] opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <button
          type="button"
          aria-label={`Réordonner « ${page.name} »`}
          className="mt-1 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-white/25 transition-colors hover:text-white/70 active:cursor-grabbing"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <DragDots />
        </button>
        <Link
          href={`/admin/clients/${profileId}/projects/${projectId}/pages/${page.id}`}
          className="group flex min-w-0 flex-1 flex-col gap-2"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-xl font-light text-white/80 transition-colors group-hover:text-[#F5F5F7] md:text-2xl">
              {page.name}
            </h3>
            {page.is_published ? (
              <StatusBadge tone="success">Publiée</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Brouillon</StatusBadge>
            )}
          </div>
          {templateLabel && (
            <Chip
              tone={
                isDetached
                  ? "muted"
                  : isRawHtmlDirect
                    ? "warning"
                    : "default"
              }
              className="w-fit"
            >
              {templateLabel}
              {dbTemplateLabel && !isDetached && !isRawHtmlDirect && (
                <span className="ml-2 text-white/35">· HTML</span>
              )}
            </Chip>
          )}
          <p className="font-mono text-[11px] text-white/35">
            <span>/{page.slug}</span>
            <span className="text-white/20"> · </span>
            <span>{formatDate(page.created_at)}</span>
          </p>
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <LotSelect
          value={page.lot_id}
          lots={lots}
          onChange={(lotId) => onLotChange(page.id, lotId)}
        />
        {!isDetached && !isRawHtmlDirect && (
          <DetachPageButton
            profileId={profileId}
            projectId={projectId}
            pageId={page.id}
            pageName={page.name}
          />
        )}
        <Link
          href={`/admin/clients/${profileId}/projects/${projectId}/pages/${page.id}`}
          className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white"
        >
          <span>Éditer</span>
          <Hairline width="sm" hover="lg" />
        </Link>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Note row
// ---------------------------------------------------------------------------

function SortableNoteRow({
  note,
  lots,
  profileId,
  onLotChange,
  sortable,
}: {
  note: BoardNote;
  lots: BoardLot[];
  profileId: string;
  onLotChange: (noteId: string, lotId: string | null) => void;
  sortable: SortableRenderArg;
}) {
  const sourceLabel =
    note.source_kind === "url"
      ? "URL"
      : note.source_kind === "empty"
        ? "Vierge"
        : "Upload";
  return (
    <li
      ref={sortable.setNodeRef as (el: HTMLLIElement | null) => void}
      style={sortable.style}
      className={`flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-white/5 py-5 last:border-b-0 ${
        sortable.isDragging ? "z-10 bg-white/[0.02] opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <button
          type="button"
          aria-label={`Réordonner « ${note.title} »`}
          className="mt-1 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-white/25 transition-colors hover:text-white/70 active:cursor-grabbing"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <DragDots />
        </button>
        <Link
          href={`/admin/clients/${profileId}/context/${note.id}`}
          className="group flex min-w-0 flex-1 flex-col gap-2"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-xl font-light text-white/80 transition-colors group-hover:text-[#F5F5F7] md:text-2xl">
              {note.title}
            </h3>
            <Chip tone="muted" className="w-fit">
              Note
            </Chip>
          </div>
          <p className="font-mono text-[11px] text-white/35">
            <span>{sourceLabel}</span>
            <span className="text-white/20"> · </span>
            <span>/{note.slug}</span>
            <span className="text-white/20"> · </span>
            <span>{formatDate(note.created_at)}</span>
          </p>
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <LotSelect
          value={note.lot_id}
          lots={lots}
          onChange={(lotId) => onLotChange(note.id, lotId)}
        />
        <Link
          href={`/admin/clients/${profileId}/context/${note.id}`}
          className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white"
        >
          <span>Ouvrir</span>
          <Hairline width="sm" hover="lg" />
        </Link>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Lot selector dropdown
// ---------------------------------------------------------------------------

function LotSelect({
  value,
  lots,
  onChange,
}: {
  value: string | null;
  lots: BoardLot[];
  onChange: (lotId: string | null) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/35">
      <span>Lot</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] font-light tracking-normal text-white/80 transition-colors hover:border-white/30 focus:border-white/60 focus:outline-none"
      >
        <option value="">Aucun</option>
        {lots.map((lot, i) => (
          <option key={lot.id} value={lot.id}>
            Lot {String(i + 1).padStart(2, "0")}
            {lot.name ? ` · ${lot.name}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Create-lot inline form
// ---------------------------------------------------------------------------

function CreateLotForm({
  onCreate,
}: {
  onCreate: (name: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        className="self-start"
      >
        + Nouveau lot
      </Button>
    );
  }

  function commit() {
    const trimmed = name.trim();
    onCreate(trimmed.length === 0 ? null : trimmed);
    setName("");
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        placeholder="Nom optionnel (Enter pour créer)"
        maxLength={80}
        className="min-w-[12rem] flex-1 border-b border-white/20 bg-transparent pb-1 font-sans text-sm font-light text-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
      />
      <Button onClick={commit} variant="primary">
        Créer
      </Button>
      <button
        type="button"
        onClick={() => {
          setName("");
          setOpen(false);
        }}
        className="text-[11px] uppercase tracking-[0.32em] text-white/40 hover:text-white"
      >
        Annuler
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function DragDots() {
  return (
    <svg
      viewBox="0 0 12 16"
      aria-hidden="true"
      className="h-4 w-3"
      fill="currentColor"
    >
      <circle cx="3" cy="3" r="1.2" />
      <circle cx="9" cy="3" r="1.2" />
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="9" cy="8" r="1.2" />
      <circle cx="3" cy="13" r="1.2" />
      <circle cx="9" cy="13" r="1.2" />
    </svg>
  );
}
