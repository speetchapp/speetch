"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import type { Section, SectionMedia } from "@/lib/section-types";
import { AutosaveField, type AutosaveResult } from "./autosave-input";
import {
  removeSectionMedia,
  updateSection,
  uploadSectionMedia,
} from "./actions";
import type { ActionContext } from "./actions-types";

type Props = {
  section: Section;
  context: ActionContext;
  mode: "single" | "multi";
  accept: string;
  onSectionReplace: (s: Section) => void;
};

export function MediaUploader({
  section,
  context,
  mode,
  accept,
  onSectionReplace,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const media = section.media ?? [];

  function trigger() {
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const arr = Array.from(files);
    const list = mode === "single" ? arr.slice(0, 1) : arr;

    startTransition(async () => {
      for (const file of list) {
        const fd = new FormData();
        fd.append("profile_id", context.profileId);
        fd.append("project_id", context.projectId);
        fd.append("page_id", context.pageId);
        fd.append("section_id", section.id);
        fd.append("file", file);

        const result = await uploadSectionMedia(fd);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSectionReplace(result.section);
      }
    });
  }

  async function handleRemove(mediaUrl: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeSectionMedia({
        ...context,
        sectionId: section.id,
        mediaUrl,
      });
      if (result.ok) {
        onSectionReplace(result.section);
      } else {
        setError(result.error);
      }
    });
  }

  async function saveCaption(
    mediaUrl: string,
    caption: string,
  ): Promise<AutosaveResult> {
    const nextMedia: SectionMedia[] = media.map((m) =>
      m.url === mediaUrl ? { ...m, caption } : m,
    );
    const result = await updateSection({
      ...context,
      sectionId: section.id,
      patch: { media: nextMedia },
    });
    if (result.ok) {
      onSectionReplace({ ...section, media: nextMedia });
    }
    return result;
  }

  const isVideo = section.type === "video";
  const showAddMore = mode === "multi" || media.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={mode === "multi"}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {media.length === 0 ? (
        <button
          type="button"
          onClick={trigger}
          disabled={pending}
          className="group flex w-full flex-col items-start gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-left transition-colors hover:border-white/40 hover:bg-white/[0.04] disabled:opacity-50"
        >
          <span className="text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors group-hover:text-white">
            {pending ? "Upload…" : `+ Ajouter ${isVideo ? "une vidéo" : "une image"}`}
          </span>
          <span className="font-serif text-sm italic text-white/40">
            Glisse-dépose impossible ici — clique pour parcourir. Max 50 MB.
          </span>
        </button>
      ) : (
        <ul
          className={
            mode === "multi"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2"
              : "flex flex-col gap-4"
          }
        >
          {media.map((m) => (
            <li
              key={m.url}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="relative w-full overflow-hidden rounded-md bg-black">
                {isVideo ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={m.url}
                    controls
                    className="aspect-video w-full bg-black"
                  />
                ) : (
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={m.url}
                      alt={m.caption ?? ""}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              <AutosaveField
                initialValue={m.caption ?? ""}
                onSave={(v) => saveCaption(m.url, v)}
                placeholder="Légende (optionnelle)"
                ariaLabel="Légende du média"
                className="w-full border-b border-white/15 bg-transparent pb-2 font-sans text-sm font-light text-[#F5F5F7] placeholder:text-white/30 focus:border-white/60 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => handleRemove(m.url)}
                disabled={pending}
                className="self-start text-[10px] uppercase tracking-[0.32em] text-white/45 transition-colors hover:text-red-300/80 disabled:opacity-50"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAddMore && media.length > 0 && (
        <button
          type="button"
          onClick={trigger}
          disabled={pending}
          className="self-start text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white disabled:opacity-50"
        >
          {pending ? "Upload…" : "+ Ajouter encore"}
        </button>
      )}

      {error && (
        <p className="text-[10px] uppercase tracking-[0.32em] text-red-300/80">
          {error}
        </p>
      )}
    </div>
  );
}
