"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPage, type CreatePageState } from "./actions";
import { Field } from "@/lib/ds";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
const INITIAL_STATE: CreatePageState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/75 transition-colors duration-300 hover:text-white disabled:cursor-wait disabled:opacity-50"
    >
      <span>{pending ? "Création" : "Créer la page"}</span>
      <span className="inline-block h-px w-6 bg-current transition-all duration-500 ease-out group-hover:w-12" />
    </button>
  );
}

export function NewPageForm({
  clientId,
  projectId,
  projectName,
  initialTemplateId,
  templateLabel,
  templateTagline,
}: {
  clientId: string;
  projectId: string;
  projectName: string;
  initialTemplateId: string;
  templateLabel: string;
  templateTagline?: string;
}) {
  const [state, formAction] = useActionState(createPage, INITIAL_STATE);
  const template = { label: templateLabel, tagline: templateTagline };

  return (
    <div className="relative min-h-svh w-full px-6 py-10 md:px-16 md:py-14">
      {/* Header — mobile only */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
        className="flex items-center justify-between md:hidden"
      >
        <Link
          href={`/admin/clients/${clientId}/projects/${projectId}/pages/new`}
          className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-white/55 transition-colors duration-300 hover:text-white"
        >
          <span className="inline-block h-px w-6 bg-current transition-all duration-500 ease-out group-hover:w-10" />
          Changer de template
        </Link>
        <span className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          Nouvelle page
        </span>
      </motion.header>

      <section className="mx-auto flex max-w-2xl flex-col items-start gap-12 pt-20">
        {/* Template sélectionné — affiché comme breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex w-full flex-wrap items-center justify-between gap-3"
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
            <span className="text-white/30">Nouvelle page</span>
            <span className="mx-3 text-white/15">→</span>
            <span className="text-white/80">
              {template?.label ?? "Template inconnu"}
            </span>
          </p>

          <Link
            href={`/admin/clients/${clientId}/projects/${projectId}/pages/new`}
            className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/40 transition-colors hover:text-white"
          >
            <span className="inline-block h-px w-3 bg-current transition-all duration-500 ease-out group-hover:w-6" />
            <span>Changer de template</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.3, ease: EASE_OUT_EXPO }}
          className="flex flex-col gap-3"
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/55">
            Projet : {projectName}
          </p>
          <h1
            className="font-sans font-extralight leading-[0.85] tracking-[-0.05em] text-[#F5F5F7]"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}
          >
            {template?.label ?? "Nouvelle page"}
          </h1>
          {template?.tagline && (
            <p className="max-w-lg font-serif text-base italic text-white/45 md:text-lg">
              {template.tagline}
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
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="template_id" value={initialTemplateId} />

          <Field label="Titre de la page">
            <input
              type="text"
              name="name"
              required
              autoFocus
              autoComplete="off"
              placeholder="Brief direction artistique"
              className="border-b border-white/20 bg-transparent pb-3 font-sans text-xl font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none md:text-2xl"
            />
          </Field>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_published"
              className="h-4 w-4 cursor-pointer accent-[#F5F5F7]"
            />
            <span className="text-[11px] uppercase tracking-[0.32em] text-white/55">
              Publier cette page immédiatement
            </span>
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
            <Link
              href={`/admin/clients/${clientId}/projects/${projectId}`}
              className="text-[11px] uppercase tracking-[0.32em] text-white/40 hover:text-white"
            >
              Annuler
            </Link>
            <SubmitButton />
          </div>
        </motion.form>
      </section>
    </div>
  );
}
