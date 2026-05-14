"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertDialog, Button, Chip, ConfirmDialog } from "@/lib/ds";
import { cn } from "@/lib/utils";
import { refreshContextSnapshot, setContextPublishing } from "../actions";

type ProjectOption = {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
};

/**
 * Panneau "Publier dans un projet" sur la page détail d'une note de contexte.
 *
 * Deux contrôles :
 *  - <select> du projet de destination (parmi les projets du client)
 *  - <Switch> pour publier / dépublier
 *
 * Publier crée un SNAPSHOT (copie le content actuel dans une page de la
 * table `pages`). Modifier la note après publication ne se propage pas
 * automatiquement — il faut toggle off / on pour rafraîchir.
 */
export function PublishingPanel({
  profileId,
  contextId,
  clientSlug,
  initialProjectId,
  initialPublishedPageId,
  projects,
}: {
  profileId: string;
  contextId: string;
  clientSlug: string | null;
  initialProjectId: string | null;
  initialPublishedPageId: string | null;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId ?? "",
  );
  const [publishedPageId, setPublishedPageId] = useState<string | null>(
    initialPublishedPageId,
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshedFlash, setRefreshedFlash] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<{
    fromProjectId: string;
    toProjectId: string;
  } | null>(null);

  const isPublished = publishedPageId !== null;

  const currentProject = projects.find(
    (p) => p.id === (isPublished ? initialProjectId : selectedProjectId),
  );

  const publishedProjectMeta = projects.find(
    (p) => p.id === initialProjectId,
  );

  function callServer(args: {
    projectId: string | null;
    isPublished: boolean;
  }) {
    setError(null);
    startTransition(async () => {
      const result = await setContextPublishing({
        profileId,
        contextId,
        projectId: args.projectId,
        isPublished: args.isPublished,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPublishedPageId(result.publishedPageId);
      router.refresh();
    });
  }

  function onTogglePublish() {
    if (pending) return;
    if (!isPublished) {
      // Tentative de publication
      if (!selectedProjectId) {
        setError("Choisis d'abord un projet de destination dans le menu.");
        return;
      }
      callServer({ projectId: selectedProjectId, isPublished: true });
    } else {
      // Dépublier (garde la sélection de projet)
      callServer({
        projectId: selectedProjectId || null,
        isPublished: false,
      });
    }
  }

  function onProjectChange(nextId: string) {
    setSelectedProjectId(nextId);
    // Si déjà publiée dans un autre projet : confirmation avant switch
    if (isPublished && initialProjectId && initialProjectId !== nextId) {
      setConfirmSwitch({
        fromProjectId: initialProjectId,
        toProjectId: nextId,
      });
    }
  }

  function onConfirmSwitch() {
    if (!confirmSwitch) return;
    callServer({
      projectId: confirmSwitch.toProjectId,
      isPublished: true,
    });
    setConfirmSwitch(null);
  }

  function onRefreshSnapshot() {
    if (pending || !isPublished) return;
    setError(null);
    startTransition(async () => {
      const result = await refreshContextSnapshot({ profileId, contextId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRefreshedFlash(true);
      window.setTimeout(() => setRefreshedFlash(false), 2200);
      router.refresh();
    });
  }

  const fromProject = confirmSwitch
    ? projects.find((p) => p.id === confirmSwitch.fromProjectId)
    : null;
  const toProject = confirmSwitch
    ? projects.find((p) => p.id === confirmSwitch.toProjectId)
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/45">
            Publication dans un projet
          </span>
          <span className="font-serif text-sm italic text-white/55">
            {isPublished
              ? "La note est visible côté espace client."
              : "Activer pour copier la note comme page publique du projet."}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isPublished ? (
            <Chip tone="success">Publiée</Chip>
          ) : (
            <Chip tone="muted">Brouillon</Chip>
          )}
          <Switch
            checked={isPublished}
            disabled={pending || (!isPublished && !selectedProjectId)}
            onChange={onTogglePublish}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="publish-project-select"
          className="text-[10px] uppercase tracking-[0.4em] text-white/45"
        >
          Projet de destination
        </label>
        <select
          id="publish-project-select"
          value={selectedProjectId}
          onChange={(e) => onProjectChange(e.target.value)}
          disabled={pending}
          className="border-b border-white/20 bg-transparent pb-3 font-sans text-lg font-light text-[#F5F5F7] focus:border-white/80 focus:outline-none"
        >
          <option value="" className="bg-black text-white/80">
            — Sélectionner un projet —
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id} className="bg-black text-white/80">
              {p.name}
              {!p.is_published ? " (projet brouillon)" : ""}
            </option>
          ))}
        </select>
        {projects.length === 0 && (
          <span className="text-[11px] italic text-white/45">
            Aucun projet pour ce client — crée-en un avant de publier la note.
          </span>
        )}
      </div>

      {isPublished && publishedProjectMeta && clientSlug && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/85">
                Page publique active
              </p>
              <p className="font-mono text-[12px] text-white/70">
                /clients/{clientSlug}/{publishedProjectMeta.slug}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {refreshedFlash && (
                <span className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/85">
                  ✓ Snapshot à jour
                </span>
              )}
              <Button
                onClick={onRefreshSnapshot}
                variant="ghost"
                disabled={pending}
              >
                {pending ? "…" : "Rafraîchir le snapshot"}
              </Button>
            </div>
          </div>
          {!publishedProjectMeta.is_published && (
            <p className="mt-2 text-[11px] italic text-amber-200/75">
              Le projet est en brouillon — la note ne sera réellement visible
              qu&apos;une fois le projet publié.
            </p>
          )}
          <p className="mt-2 text-[11px] italic text-white/40">
            Le snapshot ne se met pas à jour automatiquement. Si tu modifies
            la note (texte, masquage, style Speetch…), clique « Rafraîchir »
            pour répercuter côté espace client.
          </p>
        </div>
      )}

      {currentProject && !isPublished && (
        <p className="text-[11px] italic text-white/45">
          Activer le toggle copiera le contenu actuel de la note dans une page
          du projet « {currentProject.name} ». Le snapshot ne sera pas
          synchronisé automatiquement après modifications.
        </p>
      )}

      <ConfirmDialog
        open={confirmSwitch !== null}
        tone="warning"
        title="Changer de projet de publication ?"
        description={
          <span className="flex flex-col gap-2">
            <span className="text-sm italic text-white/55">
              La note est actuellement publiée dans «{" "}
              {fromProject?.name ?? "—"} ». Tu vas dépublier de là et republier
              dans « {toProject?.name ?? "—"} ».
            </span>
            <span className="text-sm italic text-white/45">
              L&apos;URL publique précédente cessera de fonctionner.
            </span>
          </span>
        }
        confirmLabel="Republier"
        cancelLabel="Annuler"
        pending={pending}
        onConfirm={onConfirmSwitch}
        onCancel={() => {
          setConfirmSwitch(null);
          setSelectedProjectId(initialProjectId ?? "");
        }}
      />
      <AlertDialog
        open={error !== null}
        title="Action impossible"
        description={error}
        onClose={() => setError(null)}
      />
    </div>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors",
        checked
          ? "border-emerald-300/60 bg-emerald-400/30"
          : "border-white/20 bg-white/[0.06]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[3px] block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
