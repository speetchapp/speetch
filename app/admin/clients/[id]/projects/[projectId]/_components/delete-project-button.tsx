"use client";

import { useState, useTransition } from "react";
import { Button } from "@/lib/ds";
import { deleteProject } from "../actions";

export function DeleteProjectButton({
  profileId,
  projectId,
  projectName,
  className,
}: {
  profileId: string;
  projectId: string;
  projectName: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (
      !window.confirm(
        `Supprimer définitivement le projet « ${projectName} » et toutes ses pages ?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteProject({ profileId, projectId });
      if (!result.ok) {
        setError(result.error);
        window.alert(`Erreur : ${result.error}`);
      }
    });
  }

  return (
    <>
      <Button
        onClick={onClick}
        disabled={pending}
        variant="danger"
        className={className}
        pending={pending}
        pendingLabel="Suppression…"
      >
        Supprimer
      </Button>
      {error && <span className="sr-only">{error}</span>}
    </>
  );
}
