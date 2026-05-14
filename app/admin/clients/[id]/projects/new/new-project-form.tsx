"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { getProjectType } from "@/lib/project-types";
import { Button, Eyebrow, Field } from "@/lib/ds";
import { createProject, type CreateProjectState } from "./actions";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
const INITIAL_STATE: CreateProjectState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      pending={pending}
      pendingLabel="Création"
      variant="primary"
    >
      Créer le projet
    </Button>
  );
}

export function NewProjectForm({
  clientId,
  clientName,
  clientSlug,
  initialType,
}: {
  clientId: string;
  clientName: string;
  clientSlug: string;
  initialType: string;
}) {
  const [state, formAction] = useActionState(createProject, INITIAL_STATE);
  const selectedType = getProjectType(initialType);

  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      {/* Header — mobile only */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
        className="flex items-center justify-between md:hidden"
      >
        <Button
          href={`/admin/clients/${clientId}/projects/new`}
          variant="return"
        >
          Changer de type
        </Button>
        <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          Nouveau projet
        </span>
      </motion.header>

      <section className="mx-auto flex max-w-2xl flex-col items-start gap-12 pt-20">
        {/* Type sélectionné — affiché comme breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex w-full flex-wrap items-center justify-between gap-3"
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
            <span className="text-white/30">Nouveau projet</span>
            <span className="mx-3 text-white/15">→</span>
            <span className="text-white/80">
              {selectedType?.label ?? "Type inconnu"}
            </span>
          </p>

          <Button
            href={`/admin/clients/${clientId}/projects/new`}
            variant="return"
            className="text-white/40"
          >
            Changer de type
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.3, ease: EASE_OUT_EXPO }}
          className="flex flex-col gap-3"
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/55">
            Client : {clientName}
            {clientSlug && (
              <span className="ml-2 font-mono text-white/35">
                /clients/{clientSlug}
              </span>
            )}
          </p>
          <h1
            className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}
          >
            {selectedType?.label ?? "Nouveau projet"}
          </h1>
          {selectedType?.tagline && (
            <p className="max-w-lg font-serif text-base italic text-white/45 md:text-lg">
              {selectedType.tagline}
            </p>
          )}
        </motion.div>

        <motion.form
          action={formAction}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: EASE_OUT_EXPO }}
          className="flex w-full max-w-2xl flex-col gap-10"
        >
          <input type="hidden" name="profile_id" value={clientId} />
          <input type="hidden" name="project_type" value={initialType} />

          <Field label="Nom du projet">
            <input
              type="text"
              name="name"
              required
              autoFocus
              autoComplete="off"
              placeholder="Campagne printemps · 2026"
              className="border-b border-white/20 bg-transparent pb-3 font-sans text-xl font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none md:text-2xl"
            />
          </Field>

          <Field label="Sous-titre" hint="optionnel">
            <input
              type="text"
              name="subtitle"
              autoComplete="off"
              placeholder="Direction artistique · Mai 2026"
              className="border-b border-white/20 bg-transparent pb-3 font-sans text-lg font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
            />
          </Field>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked
              className="h-4 w-4 cursor-pointer accent-[#F5F5F7]"
            />
            <Eyebrow tracking="md">Publier ce projet immédiatement</Eyebrow>
          </label>

          <AnimatePresence>
            {state.status === "error" && state.error && (
              <motion.p
                key={state.error}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                className="text-[11px] uppercase tracking-[0.32em] text-red-300/80"
              >
                {state.error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between border-t border-white/10 pt-6">
            <Button href="/admin/clients" variant="ghost">
              Annuler
            </Button>
            <SubmitButton />
          </div>
        </motion.form>
      </section>
    </div>
  );
}
