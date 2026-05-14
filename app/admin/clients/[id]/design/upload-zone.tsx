"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { uploadDesignFiles, type UploadState } from "./actions";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
const INITIAL_UPLOAD_STATE: UploadState = { status: "idle" };

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/75 transition-colors duration-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      <span>
        {pending
          ? "Téléversement"
          : count === 0
            ? "Aucun fichier"
            : `Téléverser ${count} fichier${count > 1 ? "s" : ""}`}
      </span>
      <span className="inline-block h-px w-6 bg-current transition-all duration-500 ease-out group-hover:w-12" />
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function UploadZone({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<UploadState, FormData>(
    uploadDesignFiles,
    INITIAL_UPLOAD_STATE,
  );
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const syncInput = (files: File[]) => {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    inputRef.current.files = dt.files;
  };

  const addFiles = (newFiles: File[]) => {
    const merged = [...staged, ...newFiles];
    setStaged(merged);
    syncInput(merged);
  };

  const removeAt = (idx: number) => {
    const next = staged.filter((_, i) => i !== idx);
    setStaged(next);
    syncInput(next);
  };

  // Reset staged après succès
  if (state.status === "success" && staged.length > 0) {
    setTimeout(() => {
      setStaged([]);
      syncInput([]);
    }, 0);
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="client_id" value={clientId} />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
          }
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center transition-all duration-500 ease-out",
          dragOver
            ? "border-white/50 bg-white/[0.05] backdrop-blur-sm"
            : "border-white/15 bg-white/[0.01] hover:border-white/30 hover:bg-white/[0.025]",
        )}
      >
        <span className="text-[11px] uppercase tracking-[0.4em] text-white/45 group-hover:text-white/70">
          {dragOver
            ? "Relâche pour ajouter"
            : "Glisse des fichiers ici ou clique pour parcourir"}
        </span>
        <span className="font-serif text-sm italic text-white/35">
          Tous formats acceptés · 10 Mo max par fichier
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="files"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            // Ne pas appeler addFiles ici : on remplace direct la liste
            // pour rester en phase avec input.files si l'utilisateur
            // utilise le picker plusieurs fois de suite.
            const dt = new DataTransfer();
            const combined = [
              ...staged,
              ...Array.from(e.target.files),
            ];
            combined.forEach((f) => dt.items.add(f));
            if (inputRef.current) inputRef.current.files = dt.files;
            setStaged(combined);
          }
        }}
        className="hidden"
      />

      {/* Liste des fichiers stagés */}
      <AnimatePresence>
        {staged.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="flex flex-col overflow-hidden border-t border-white/10"
          >
            {staged.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between gap-4 border-b border-white/10 py-3"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-white/70">
                  {file.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-white/35">
                  {formatSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="shrink-0 text-[11px] uppercase tracking-[0.32em] text-white/35 transition-colors hover:text-red-300/80"
                >
                  Retirer
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Feedback */}
      <AnimatePresence>
        {state.status === "error" && state.error && (
          <motion.p
            key={`err-${state.error}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="text-[11px] uppercase tracking-[0.32em] text-red-300/80"
          >
            {state.error}
          </motion.p>
        )}
        {state.status === "success" && state.uploaded && (
          <motion.p
            key={`ok-${state.uploaded}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-emerald-300/80"
          >
            <span className="block h-1 w-1 rounded-full bg-emerald-300" />
            {state.uploaded} fichier{state.uploaded > 1 ? "s" : ""} téléversé
            {state.uploaded > 1 ? "s" : ""}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-end">
        <SubmitButton count={staged.length} />
      </div>
    </form>
  );
}
