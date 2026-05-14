"use client";

import { useState, useTransition } from "react";
import {
  getSectionTypeLabel,
  type Section,
} from "@/lib/section-types";
import { ConfirmDialog } from "@/lib/ds";
import { AutosaveField, type AutosaveResult } from "./autosave-input";
import { MediaUploader } from "./media-uploader";
import { updateSection } from "./actions";
import type { ActionContext } from "./actions-types";

type Props = {
  section: Section;
  index: number;
  total: number;
  context: ActionContext;
  onReplace: (s: Section) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
};

export function SectionEditor({
  section,
  index,
  total,
  context,
  onReplace,
  onRemove,
  onMove,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function savePatch(
    patch: Partial<Section>,
  ): Promise<AutosaveResult> {
    const result = await updateSection({
      ...context,
      sectionId: section.id,
      patch,
    });
    if (result.ok) {
      onReplace({ ...section, ...patch, id: section.id, type: section.type });
    }
    return result;
  }

  function handleConfirmRemove() {
    startTransition(() => {
      onRemove();
      setConfirmOpen(false);
    });
  }

  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.015] p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/30">
            {String(index + 1).padStart(2, "0")}
            <span className="mx-2 text-white/15">/</span>
            {String(total).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.28em] text-white/70">
            {getSectionTypeLabel(section.type)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0 || pending}
            aria-label="Monter la section"
            className="rounded-md px-2 py-1 text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === total - 1 || pending}
            aria-label="Descendre la section"
            className="rounded-md px-2 py-1 text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            aria-label="Supprimer la section"
            className="rounded-md px-2 py-1 text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-red-300/80 disabled:opacity-30"
          >
            ×
          </button>
        </div>
      </header>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="Supprimer cette section ?"
        description="Les médias attachés à la section seront aussi effacés du stockage. Action irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmOpen(false)}
      />

      <AutosaveField
        initialValue={section.title ?? ""}
        onSave={(v) => savePatch({ title: v })}
        placeholder="Titre de la section"
        ariaLabel="Titre"
        className="w-full border-b border-white/15 bg-transparent pb-3 font-sans text-lg font-light text-[#F5F5F7] placeholder:text-white/30 focus:border-white/60 focus:outline-none md:text-xl"
      />

      {section.type === "text" && (
        <AutosaveField
          multiline
          rows={6}
          initialValue={section.body ?? ""}
          onSave={(v) => savePatch({ body: v })}
          placeholder="Corps du texte…"
          ariaLabel="Corps du texte"
          className="w-full resize-y rounded-md border border-white/10 bg-white/[0.02] p-4 font-serif text-base text-[#F5F5F7]/90 placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
      )}

      {section.type === "embed" && (
        <AutosaveField
          initialValue={section.embedUrl ?? ""}
          onSave={(v) => savePatch({ embedUrl: v })}
          placeholder="https://vimeo.com/… · https://youtu.be/… · https://figma.com/file/…"
          ariaLabel="URL à intégrer"
          className="w-full border-b border-white/15 bg-transparent pb-3 font-mono text-sm text-[#F5F5F7] placeholder:text-white/30 focus:border-white/60 focus:outline-none"
        />
      )}

      {(section.type === "image" || section.type === "video") && (
        <MediaUploader
          section={section}
          context={context}
          mode="single"
          accept={section.type === "image" ? "image/*" : "video/*"}
          onSectionReplace={onReplace}
        />
      )}

      {section.type === "gallery" && (
        <MediaUploader
          section={section}
          context={context}
          mode="multi"
          accept="image/*"
          onSectionReplace={onReplace}
        />
      )}
    </article>
  );
}
