"use client";

import { useFormStatus } from "react-dom";
import { deleteTemplate } from "./new/actions";

function DeleteButton({ usageCount }: { usageCount: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        const message =
          usageCount > 0
            ? `Supprimer ce template ? ${usageCount} page${
                usageCount > 1 ? "s" : ""
              } l'utilise${usageCount > 1 ? "nt" : ""} déjà — elles garderont leur contenu mais perdront le lien vers le template.`
            : "Supprimer ce template définitivement ?";
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
      className="text-[11px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-red-300/80 disabled:opacity-50"
    >
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

export function DeleteTemplateForm({
  templateId,
  usageCount,
}: {
  templateId: string;
  usageCount: number;
}) {
  return (
    <form action={deleteTemplate}>
      <input type="hidden" name="template_id" value={templateId} />
      <DeleteButton usageCount={usageCount} />
    </form>
  );
}
