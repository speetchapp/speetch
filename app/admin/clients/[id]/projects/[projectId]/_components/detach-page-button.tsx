"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { detachPage } from "../pages/[pageId]/actions";

export function DetachPageButton({
  profileId,
  projectId,
  pageId,
  pageName,
}: {
  profileId: string;
  projectId: string;
  pageId: string;
  pageName: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        `Détacher « ${pageName} » de son template ? La page garde tout son contenu mais perd le lien vers le template d'origine.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await detachPage({ profileId, projectId, pageId });
      if (!result.ok) {
        window.alert(result.error || "Erreur lors du détachement.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-white disabled:opacity-50"
    >
      {pending ? "Détachement…" : "Détacher"}
    </button>
  );
}
