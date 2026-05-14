"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertDialog } from "@/lib/ds";
import { cn } from "@/lib/utils";
import { setContextSpeetchStyle } from "../actions";

/**
 * Bouton réutilisable (liste + viewer) pour activer/désactiver l'overlay
 * CSS Speetch sur une note de contexte raw_html.
 *
 * Variante :
 *  - "chip" : pour les lignes de liste (petit, dans la chip strip)
 *  - "full" : pour la toolbar du viewer (texte explicite + état visible)
 */
export function SpeetchStyleButton({
  profileId,
  contextId,
  initialEnabled,
  variant = "chip",
}: {
  profileId: string;
  contextId: string;
  initialEnabled: boolean;
  variant?: "chip" | "full";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    if (pending) return;
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setContextSpeetchStyle({
        profileId,
        contextId,
        enabled: next,
      });
      if (!result.ok) {
        setError(result.error);
        setEnabled(!next);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "chip") {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.32em] transition-colors",
            enabled
              ? "border-[#F5F5F7]/40 bg-white/[0.08] text-[#F5F5F7]"
              : "border-white/15 bg-white/[0.02] text-white/45 hover:border-white/30 hover:text-white/75",
            pending && "opacity-50",
          )}
          title="Active/désactive l'overlay CSS Speetch sur la note"
        >
          <span
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              enabled ? "bg-[#F5F5F7]" : "bg-white/30",
            )}
          />
          <span>{enabled ? "Style Speetch ON" : "Style Speetch"}</span>
        </button>
        <AlertDialog
          open={error !== null}
          title="Action impossible"
          description={error}
          onClose={() => setError(null)}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "group inline-flex items-center gap-3 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.32em] transition-colors",
          enabled
            ? "border-[#F5F5F7]/40 bg-white/[0.08] text-[#F5F5F7]"
            : "border-white/15 bg-white/[0.02] text-white/60 hover:border-white/30 hover:text-white",
          pending && "cursor-wait opacity-50",
        )}
      >
        <span
          className={cn(
            "block h-2 w-2 rounded-full transition-colors",
            enabled ? "bg-[#F5F5F7]" : "bg-white/30",
          )}
        />
        <span>
          {pending ? "…" : enabled ? "Style Speetch · ON" : "Style Speetch"}
        </span>
      </button>
      <AlertDialog
        open={error !== null}
        title="Action impossible"
        description={error}
        onClose={() => setError(null)}
      />
    </>
  );
}
