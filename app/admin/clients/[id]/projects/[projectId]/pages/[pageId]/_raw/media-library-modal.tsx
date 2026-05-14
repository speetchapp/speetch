"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Modal, ModalHeader } from "@/lib/ds";
import {
  deleteProjectMedia,
  listProjectMedia,
  uploadProjectMedia,
} from "./actions";
import type { ProjectMediaItem } from "./actions-types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function displayName(name: string): string {
  return name.replace(/^\d{10,14}-/, "");
}

export function MediaLibraryModal({
  projectId,
  currentUrl,
  onSelect,
  onClose,
}: {
  projectId: string;
  currentUrl: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ProjectMediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await listProjectMedia(projectId);
      if (res.ok) {
        setItems(res.items);
      } else {
        setError(res.error);
        setItems([]);
      }
    });
  }, [projectId]);

  // Escape handled by <Modal>

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("project_id", projectId);
    formData.append("file", file);
    const res = await uploadProjectMedia(formData);
    if (res.ok) {
      setItems((prev) => (prev ? [res.item, ...prev] : [res.item]));
    } else {
      setError(res.error);
    }
    setUploading(false);
  }

  async function handleDelete(path: string) {
    if (!window.confirm("Supprimer ce média de la médiathèque ?")) return;
    const res = await deleteProjectMedia(projectId, path);
    if (res.ok) {
      setItems((prev) => (prev ? prev.filter((i) => i.path !== path) : prev));
    } else {
      setError(res.error);
    }
  }

  return (
    <Modal open={true} onClose={onClose}>
      <ModalHeader
        title="Médiathèque du projet"
        subtitle={
          items === null
            ? "Chargement…"
            : items.length === 0
              ? "Aucun média"
              : `${items.length} média${items.length > 1 ? "s" : ""}`
        }
        onClose={onClose}
        actions={
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="primary"
            pending={uploading}
            pendingLabel="Upload…"
          >
            + Téléverser
          </Button>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />

          {/* Erreur */}
          {error && (
            <p className="border-b border-red-400/20 bg-red-400/5 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-red-300/80 md:px-8">
              {error}
            </p>
          )}

          {/* Grille */}
          <div className="flex-1 overflow-auto px-6 py-6 md:px-8 md:py-8">
            {items === null ? (
              <p className="font-serif italic text-white/40">Chargement…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-start gap-4">
                <p className="font-serif italic text-white/40">
                  Aucun média pour ce projet. Téléverse une image ou une vidéo
                  pour démarrer.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => {
                  const isCurrent = currentUrl === item.url;
                  const isVideo = /\.(mp4|webm|mov)$/i.test(item.name);
                  return (
                    <li key={item.path} className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item.url);
                          onClose();
                        }}
                        className={`group relative aspect-square w-full overflow-hidden rounded-md border bg-black/40 transition ${
                          isCurrent
                            ? "border-white/70 ring-2 ring-white/40"
                            : "border-white/10 hover:border-white/40"
                        }`}
                      >
                        {isVideo ? (
                          <video
                            src={item.url}
                            preload="metadata"
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {isCurrent && (
                          <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] text-black">
                            Actuel
                          </span>
                        )}
                      </button>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-mono text-[11px] text-white/55">
                          {displayName(item.name)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.path)}
                          className="text-[10px] uppercase tracking-[0.28em] text-white/35 transition-colors hover:text-red-300/80"
                        >
                          Suppr.
                        </button>
                      </div>
                      <span className="font-mono text-[10px] text-white/30">
                        {formatSize(item.size)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {pending && items === null && (
            <div className="border-t border-white/10 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white/40 md:px-8">
              Chargement de la médiathèque…
            </div>
          )}
    </Modal>
  );
}
