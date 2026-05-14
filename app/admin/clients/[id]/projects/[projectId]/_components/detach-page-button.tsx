"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, Button, ConfirmDialog } from "@/lib/ds";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      const result = await detachPage({ profileId, projectId, pageId });
      if (!result.ok) {
        setError(result.error || "Erreur lors du détachement.");
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        onClick={() => setConfirmOpen(true)}
        variant="ghost"
        pending={pending}
        pendingLabel="Détachement…"
      >
        Détacher
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        tone="warning"
        title={`Détacher « ${pageName} » de son template ?`}
        description="La page garde tout son contenu mais perd le lien vers le template d'origine. Tu pourras toujours la modifier librement après le détachement."
        confirmLabel="Détacher"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
      <AlertDialog
        open={error !== null}
        title="Détachement impossible"
        description={error}
        onClose={() => setError(null)}
      />
    </>
  );
}
