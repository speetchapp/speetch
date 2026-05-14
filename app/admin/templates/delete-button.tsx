"use client";

import { useState, useTransition } from "react";
import { Button, ConfirmDialog } from "@/lib/ds";
import { deleteTemplate } from "./new/actions";

export function DeleteTemplateForm({
  templateId,
  usageCount,
}: {
  templateId: string;
  usageCount: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const description =
    usageCount > 0
      ? `${usageCount} page${usageCount > 1 ? "s" : ""} ${usageCount > 1 ? "utilisent" : "utilise"} déjà ce template. Elles garderont leur contenu mais perdront le lien vers le template.`
      : "Action irréversible.";

  function onConfirm() {
    const formData = new FormData();
    formData.append("template_id", templateId);
    startTransition(async () => {
      await deleteTemplate(formData);
      setConfirmOpen(false);
    });
  }

  return (
    <>
      <Button
        onClick={() => setConfirmOpen(true)}
        variant="danger"
        pending={pending}
        pendingLabel="Suppression…"
      >
        Supprimer
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="Supprimer ce template ?"
        description={description}
        confirmLabel="Supprimer le template"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
