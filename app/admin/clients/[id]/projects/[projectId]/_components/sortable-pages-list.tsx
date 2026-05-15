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
import { useEffect, useState, useTransition } from "react";
import { Chip, Hairline, StatusBadge } from "@/lib/ds";
import {
  CUSTOM_TEMPLATE_ID,
  RAW_HTML_VIRTUAL_TEMPLATE_ID,
  getPageTemplate,
} from "@/lib/page-templates";
import { reorderProjectPages } from "../actions";
import { DetachPageButton } from "./detach-page-button";

export type SortablePageRow = {
  id: string;
  name: string;
  slug: string;
  template_id: string;
  position: number;
  is_published: boolean;
  created_at: string;
};

export function SortablePagesList({
  profileId,
  projectId,
  pages: initialPages,
  dbTemplateLabels,
}: {
  profileId: string;
  projectId: string;
  pages: SortablePageRow[];
  dbTemplateLabels: Record<string, string>;
}) {
  const [pages, setPages] = useState<SortablePageRow[]>(initialPages);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Si le parent re-render avec une nouvelle liste (router.refresh, navigation,
  // suppression d'une page…), on resynchronise.
  useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = pages;
    const reordered = arrayMove(pages, oldIndex, newIndex);
    setPages(reordered);
    setError(null);

    startTransition(async () => {
      const result = await reorderProjectPages({
        profileId,
        projectId,
        pageIds: reordered.map((p) => p.id),
      });
      if (!result.ok) {
        setError(result.error);
        setPages(previous);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="border-l-2 border-red-400/40 pl-4 text-[11px] uppercase tracking-[0.32em] text-red-300/80">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            className={`flex flex-col border-t border-white/10 ${pending ? "opacity-90" : ""}`}
          >
            {pages.map((page) => (
              <SortablePageItem
                key={page.id}
                page={page}
                profileId={profileId}
                projectId={projectId}
                dbTemplateLabel={dbTemplateLabels[page.template_id]}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortablePageItem({
  page,
  profileId,
  projectId,
  dbTemplateLabel,
}: {
  page: SortablePageRow;
  profileId: string;
  projectId: string;
  dbTemplateLabel: string | undefined;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const codeTemplate = getPageTemplate(page.template_id);
  const isDetached = page.template_id === CUSTOM_TEMPLATE_ID;
  const isRawHtmlDirect = page.template_id === RAW_HTML_VIRTUAL_TEMPLATE_ID;
  const templateLabel = isDetached
    ? "Détachée"
    : isRawHtmlDirect
      ? "Reproduction fidèle"
      : (codeTemplate?.label ?? dbTemplateLabel ?? null);
  const formattedDate = new Date(page.created_at).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 border-b border-white/10 py-7 ${
        isDragging ? "z-10 bg-white/[0.02] opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <button
          type="button"
          aria-label={`Réordonner « ${page.name} »`}
          className="mt-1 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-white/25 transition-colors hover:text-white/70 focus:text-white/70 focus:outline-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
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
        </button>

        <Link
          href={`/admin/clients/${profileId}/projects/${projectId}/pages/${page.id}`}
          className="group flex min-w-0 flex-1 flex-col gap-2"
        >
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <h2 className="text-2xl font-light text-white/80 transition-colors group-hover:text-[#F5F5F7] md:text-3xl">
              {page.name}
            </h2>
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
            <span>{formattedDate}</span>
          </p>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-6">
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
