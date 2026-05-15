"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createAnnotation,
  deleteAnnotation,
  updateAnnotationComment,
} from "@/app/clients/[slug]/annotation-actions";

export type AnnotationColor = "yellow" | "green" | "pink" | "blue";

export type AnnotationData = {
  id: string;
  color: AnnotationColor;
  anchor_exact: string;
  anchor_prefix: string;
  anchor_suffix: string;
  comment: string | null;
};

const COLOR_SWATCHES: Array<{ value: AnnotationColor; hex: string; label: string }> = [
  { value: "yellow", hex: "#fef08a", label: "Jaune" },
  { value: "green", hex: "#bbf7d0", label: "Vert" },
  { value: "pink", hex: "#fbcfe8", label: "Rose" },
  { value: "blue", hex: "#bfdbfe", label: "Bleu" },
];

const MAX_COMMENT_LEN = 2000;

type SelectionPopover = {
  kind: "select";
  exact: string;
  prefix: string;
  suffix: string;
  x: number;
  y: number;
};

type CommentPopover = {
  kind: "comment";
  annotationId: string;
  initialValue: string;
  x: number;
  y: number;
};

type HighlightPopover = {
  kind: "highlight";
  annotationId: string;
  x: number;
  y: number;
};

type Popover = SelectionPopover | CommentPopover | HighlightPopover | null;

export function AnnotationsOverlay({
  clientSlug,
  targetKind,
  targetId,
  iframeRef,
  initialAnnotations,
}: {
  clientSlug: string;
  targetKind: "page" | "context";
  targetId: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  initialAnnotations: AnnotationData[];
}) {
  const [annotations, setAnnotations] =
    useState<AnnotationData[]>(initialAnnotations);
  const [popover, setPopover] = useState<Popover>(null);
  const [busy, setBusy] = useState(false);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const sendApply = useCallback(
    (list: AnnotationData[]) => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: "speetch-annot-apply", annotations: list },
        "*",
      );
    },
    [iframeRef],
  );

  useEffect(() => {
    sendApply(annotations);
  }, [annotations, sendApply]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as
        | { type?: string; [k: string]: unknown }
        | null;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "speetch-annot-ready") {
        sendApply(annotationsRef.current);
        return;
      }

      const iframe = iframeRef.current;
      if (!iframe) return;
      const rect = iframe.getBoundingClientRect();

      if (data.type === "speetch-annot-selection") {
        const exact = String(data.exact ?? "");
        const prefix = String(data.prefix ?? "");
        const suffix = String(data.suffix ?? "");
        const x = Number(data.x ?? 0);
        const y = Number(data.y ?? 0);
        if (!exact.trim()) return;
        setPopover({
          kind: "select",
          exact,
          prefix,
          suffix,
          x: rect.left + x,
          y: rect.top + y,
        });
        return;
      }

      if (data.type === "speetch-annot-click") {
        const id = String(data.id ?? "");
        const x = Number(data.x ?? 0);
        const y = Number(data.y ?? 0);
        if (!id) return;
        setPopover({
          kind: "highlight",
          annotationId: id,
          x: rect.left + x,
          y: rect.top + y,
        });
        return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef, sendApply]);

  useEffect(() => {
    if (!popover) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopover(null);
    }
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-annot-popover]")) setPopover(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [popover]);

  const onPickColor = useCallback(
    async (color: AnnotationColor) => {
      if (popover?.kind !== "select" || busy) return;
      setBusy(true);
      const res = await createAnnotation({
        clientSlug,
        targetKind,
        targetId,
        color,
        exact: popover.exact,
        prefix: popover.prefix,
        suffix: popover.suffix,
      });
      setBusy(false);
      if (!res.ok) {
        console.error("[annotation create] error:", res.error);
        return;
      }
      setAnnotations((prev) => [...prev, res.annotation]);
      // Enchaîne sur le popover de commentaire (optionnel)
      setPopover({
        kind: "comment",
        annotationId: res.annotation.id,
        initialValue: "",
        x: popover.x,
        y: popover.y,
      });
    },
    [popover, busy, clientSlug, targetKind, targetId],
  );

  const onSaveComment = useCallback(
    async (value: string) => {
      if (popover?.kind !== "comment" || busy) return;
      const trimmed = value.trim();
      const next = trimmed.length === 0 ? null : trimmed;
      setBusy(true);
      const res = await updateAnnotationComment({
        clientSlug,
        annotationId: popover.annotationId,
        comment: next,
      });
      setBusy(false);
      if (!res.ok) {
        console.error("[annotation comment] error:", res.error);
        return;
      }
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === popover.annotationId ? { ...a, comment: res.comment } : a,
        ),
      );
      setPopover(null);
    },
    [popover, busy, clientSlug],
  );

  const onRemove = useCallback(async () => {
    if (popover?.kind !== "highlight" || busy) return;
    setBusy(true);
    const res = await deleteAnnotation({
      clientSlug,
      annotationId: popover.annotationId,
    });
    setBusy(false);
    if (!res.ok) {
      console.error("[annotation delete] error:", res.error);
      return;
    }
    setAnnotations((prev) => prev.filter((a) => a.id !== popover.annotationId));
    setPopover(null);
  }, [popover, busy, clientSlug]);

  const onEditComment = useCallback(() => {
    if (popover?.kind !== "highlight") return;
    const annotation = annotations.find((a) => a.id === popover.annotationId);
    if (!annotation) return;
    setPopover({
      kind: "comment",
      annotationId: annotation.id,
      initialValue: annotation.comment ?? "",
      x: popover.x,
      y: popover.y,
    });
  }, [popover, annotations]);

  const placement = useMemo(() => {
    if (!popover) return null;
    const PADDING = 12;
    const width =
      popover.kind === "select" ? 200 : popover.kind === "comment" ? 280 : 240;
    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const left = Math.min(popover.x + 8, viewportW - width - PADDING);
    const top = popover.y + 16;
    return { left, top, width };
  }, [popover]);

  if (!popover || !placement) return null;

  const currentAnnotation =
    popover.kind === "highlight"
      ? annotations.find((a) => a.id === popover.annotationId)
      : null;

  return (
    <div
      data-annot-popover
      role="dialog"
      style={{
        position: "fixed",
        left: placement.left,
        top: placement.top,
        width: placement.width,
        zIndex: 200,
      }}
      className="rounded-xl border border-white/10 bg-[#0a0a0a]/95 px-3 py-2 shadow-2xl backdrop-blur-md"
    >
      {popover.kind === "select" && (
        <div className="flex items-center gap-2">
          {COLOR_SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-label={`Surligner en ${s.label.toLowerCase()}`}
              onClick={() => onPickColor(s.value)}
              disabled={busy}
              className="group relative h-7 w-7 rounded-full border border-white/20 transition-transform hover:scale-110 disabled:cursor-wait disabled:opacity-50"
              style={{ background: s.hex }}
            />
          ))}
          <button
            type="button"
            onClick={() => setPopover(null)}
            disabled={busy}
            className="ml-1 text-[10px] uppercase tracking-[0.32em] text-white/45 transition-colors hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {popover.kind === "comment" && (
        <CommentForm
          initialValue={popover.initialValue}
          busy={busy}
          onSave={onSaveComment}
          onCancel={() => setPopover(null)}
        />
      )}

      {popover.kind === "highlight" && (
        <div className="flex flex-col gap-3 px-1 py-1">
          {currentAnnotation?.comment ? (
            <p className="whitespace-pre-wrap break-words font-serif text-sm italic text-white/75">
              {currentAnnotation.comment}
            </p>
          ) : (
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">
              Aucun commentaire
            </p>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={onEditComment}
              disabled={busy}
              className="text-[11px] uppercase tracking-[0.32em] text-white/55 transition-colors hover:text-white disabled:cursor-wait"
            >
              {currentAnnotation?.comment ? "Éditer" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-red-300/85 disabled:cursor-wait"
            >
              {busy ? "…" : "Retirer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentForm({
  initialValue,
  busy,
  onSave,
  onCancel,
}: {
  initialValue: string;
  busy: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        maxLength={MAX_COMMENT_LEN}
        placeholder="Ton commentaire (optionnel)"
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(value);
          }
        }}
        className="resize-none rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white/85 placeholder:text-white/30 focus:border-white/30 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-[10px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-white disabled:cursor-wait"
        >
          Plus tard
        </button>
        <button
          type="submit"
          disabled={busy}
          className="text-[11px] uppercase tracking-[0.32em] text-white/75 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? "…" : value.trim() ? "Enregistrer" : "Aucun commentaire"}
        </button>
      </div>
    </form>
  );
}
