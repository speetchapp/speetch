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
} from "@/app/clients/[slug]/annotation-actions";

export type AnnotationColor = "yellow" | "green" | "pink" | "blue";

export type AnnotationData = {
  id: string;
  color: AnnotationColor;
  anchor_exact: string;
  anchor_prefix: string;
  anchor_suffix: string;
};

const COLOR_SWATCHES: Array<{ value: AnnotationColor; hex: string; label: string }> = [
  { value: "yellow", hex: "#fef08a", label: "Jaune" },
  { value: "green", hex: "#bbf7d0", label: "Vert" },
  { value: "pink", hex: "#fbcfe8", label: "Rose" },
  { value: "blue", hex: "#bfdbfe", label: "Bleu" },
];

type SelectionPopover = {
  kind: "select";
  exact: string;
  prefix: string;
  suffix: string;
  x: number;
  y: number;
};

type HighlightPopover = {
  kind: "highlight";
  id: string;
  x: number;
  y: number;
};

type Popover = SelectionPopover | HighlightPopover | null;

/**
 * Overlay React qui dialogue avec le script injecté dans l'iframe via
 * postMessage. Gère :
 *  - la sync initiale (envoie la liste au "ready")
 *  - les sélections (affiche le popover de palette à la position relative
 *    au viewport du parent)
 *  - les clics sur highlight existant (affiche un mini bouton « Retirer »)
 *
 * À placer en sibling de l'iframe — il occupe une couche fixed sur le
 * viewport (pas absolute sur le document) pour rester visible pendant un
 * scroll en cours d'interaction.
 */
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

  // Resync à chaque changement de la liste
  useEffect(() => {
    sendApply(annotations);
  }, [annotations, sendApply]);

  // Listener postMessage de l'iframe
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
          id,
          x: rect.left + x,
          y: rect.top + y,
        });
        return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef, sendApply]);

  // Fermeture du popover sur Esc / clic hors popover
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
      setPopover(null);
    },
    [popover, busy, clientSlug, targetKind, targetId],
  );

  const onRemove = useCallback(async () => {
    if (popover?.kind !== "highlight" || busy) return;
    setBusy(true);
    const res = await deleteAnnotation({
      clientSlug,
      annotationId: popover.id,
    });
    setBusy(false);
    if (!res.ok) {
      console.error("[annotation delete] error:", res.error);
      return;
    }
    setAnnotations((prev) => prev.filter((a) => a.id !== popover.id));
    setPopover(null);
  }, [popover, busy, clientSlug]);

  const placement = useMemo(() => {
    if (!popover) return null;
    // Décale légèrement en dessous du curseur, recale si proche du bord droit
    const PADDING = 12;
    const width = popover.kind === "select" ? 200 : 110;
    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const left = Math.min(popover.x + 8, viewportW - width - PADDING);
    const top = popover.y + 16;
    return { left, top, width };
  }, [popover]);

  if (!popover || !placement) return null;

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
      {popover.kind === "select" ? (
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
      ) : (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-white/65 transition-colors hover:text-red-300/85 disabled:cursor-wait disabled:opacity-50"
        >
          <span className="inline-block h-px w-4 bg-current" />
          {busy ? "…" : "Retirer"}
        </button>
      )}
    </div>
  );
}
