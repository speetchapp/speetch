"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PROJECT_TYPES } from "@/lib/project-types";
import { updateTemplate } from "./actions";
import type { UpdateTemplateState } from "./actions-types";
import { Field } from "@/lib/ds";

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
const INITIAL_STATE: UpdateTemplateState = { status: "idle" };

type Fidelity = "edit" | "raw";

function SubmitButton({
  hasNewFile,
  fidelity,
}: {
  hasNewFile: boolean;
  fidelity: Fidelity;
}) {
  const { pending } = useFormStatus();
  let idle = "Enregistrer";
  let busy = "Enregistrement…";
  if (hasNewFile) {
    if (fidelity === "raw") {
      idle = "Remplacer le HTML";
      busy = "Import en cours…";
    } else {
      idle = "Re-convertir et enregistrer";
      busy = "Conversion en cours…";
    }
  }
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/75 transition-colors duration-300 hover:text-white disabled:cursor-wait disabled:opacity-50"
    >
      <span>{pending ? busy : idle}</span>
      <span className="inline-block h-px w-6 bg-current transition-all duration-500 ease-out group-hover:w-12" />
    </button>
  );
}

const FIDELITY_OPTIONS: Array<{
  value: Fidelity;
  label: string;
  tagline: string;
  description: string;
}> = [
  {
    value: "edit",
    label: "Édition libre",
    tagline: "Claude convertit en sections éditables",
    description:
      "Le HTML est analysé et décomposé en sections (texte, image, vidéo, embed, galerie). Style éditorial Speetch.",
  },
  {
    value: "raw",
    label: "Reproduction fidèle",
    tagline: "HTML brut tel quel, dans un iframe sandbox",
    description:
      "Pas de passage par Claude. Mise en page d'origine préservée, JS interactif (onglets, accordéons) fonctionnel.",
  },
];

function FidelityField({
  fidelity,
  onChange,
}: {
  fidelity: Fidelity;
  onChange: (value: Fidelity) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-white/45">
        <span>Niveau de fidélité</span>
        <span className="text-white/25">requiert un nouveau HTML pour changer</span>
      </legend>

      <input type="hidden" name="fidelity" value={fidelity} />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/[0.08] md:grid-cols-2">
        {FIDELITY_OPTIONS.map((opt) => {
          const active = opt.value === fidelity;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`group relative flex h-full flex-col gap-3 bg-black p-6 text-left transition-colors duration-500 ease-out hover:bg-white/[0.03] md:p-7 ${
                active ? "ring-1 ring-inset ring-white/40" : ""
              }`}
            >
              <span
                className={`text-[10px] uppercase tracking-[0.4em] transition-colors duration-500 ${
                  active ? "text-white/85" : "text-white/30 group-hover:text-white/55"
                }`}
              >
                {active ? "Sélectionné" : "Cliquer pour choisir"}
              </span>
              <span
                className="font-sans font-extralight leading-[1] tracking-[-0.02em] text-[#F5F5F7]"
                style={{ fontSize: "clamp(1.25rem, 2vw, 1.75rem)" }}
              >
                {opt.label}
              </span>
              <span className="font-serif text-sm italic text-white/55">
                {opt.tagline}
              </span>
              <span className="text-[11px] leading-relaxed text-white/45">
                {opt.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EditTemplateForm({
  templateId,
  initial,
}: {
  templateId: string;
  initial: {
    label: string;
    tagline: string;
    description: string;
    projectType: string;
    fidelity: Fidelity;
    sectionsCount: number;
    sourceHtmlBytes: number;
  };
}) {
  const [state, formAction] = useActionState(updateTemplate, INITIAL_STATE);
  const [fidelity, setFidelity] = useState<Fidelity>(initial.fidelity);
  const [hasNewFile, setHasNewFile] = useState(false);

  const fidelityChanged = fidelity !== initial.fidelity;

  return (
    <motion.form
      action={formAction}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: EASE_OUT_EXPO }}
      className="flex w-full max-w-2xl flex-col gap-10"
      encType="multipart/form-data"
    >
      <input type="hidden" name="template_id" value={templateId} />

      <Field label="Nom du template">
        <input
          type="text"
          name="label"
          required
          autoComplete="off"
          defaultValue={initial.label}
          className="border-b border-white/20 bg-transparent pb-3 font-sans text-xl font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none md:text-2xl"
        />
      </Field>

      <Field label="Tagline" hint="optionnel">
        <input
          type="text"
          name="tagline"
          autoComplete="off"
          defaultValue={initial.tagline}
          className="border-b border-white/20 bg-transparent pb-3 font-sans text-lg font-light text-[#F5F5F7] caret-[#F5F5F7] placeholder:text-white/25 focus:border-white/80 focus:outline-none"
        />
      </Field>

      <Field label="Description" hint="optionnel">
        <textarea
          name="description"
          rows={3}
          autoComplete="off"
          defaultValue={initial.description}
          className="w-full resize-y rounded-md border border-white/10 bg-white/[0.02] p-4 font-serif text-base text-[#F5F5F7]/90 placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
      </Field>

      <Field label="Type de projet" hint="aucun = tous types">
        <select
          name="project_type"
          defaultValue={initial.projectType}
          className="border-b border-white/20 bg-transparent pb-3 font-sans text-lg font-light text-[#F5F5F7] caret-[#F5F5F7] focus:border-white/80 focus:outline-none"
        >
          <option value="" className="bg-black text-white/80">
            Tous types de projet
          </option>
          {PROJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value} className="bg-black text-white/80">
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <FidelityField fidelity={fidelity} onChange={setFidelity} />

      <Field
        label="Remplacer le HTML"
        hint={
          initial.sourceHtmlBytes > 0
            ? `actuel : ${(initial.sourceHtmlBytes / 1024).toFixed(0)} ko`
            : "aucun HTML stocké"
        }
      >
        <input
          type="file"
          name="file"
          accept=".html,.htm,text/html"
          onChange={(e) => setHasNewFile((e.target.files?.length ?? 0) > 0)}
          className="block w-full text-sm text-white/70 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-[11px] file:uppercase file:tracking-[0.32em] file:text-white/80 hover:file:bg-white/20"
        />
        <span className="text-[10px] uppercase tracking-[0.32em] text-white/30">
          Optionnel — laisse vide pour ne mettre à jour que les métadonnées
        </span>
      </Field>

      {fidelityChanged && !hasNewFile && (
        <p className="border-l-2 border-amber-400/40 pl-4 text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Changer de niveau de fidélité requiert un nouveau fichier HTML.
        </p>
      )}

      {!hasNewFile && !fidelityChanged && (
        <p className="text-[10px] uppercase tracking-[0.32em] text-white/30">
          Contenu actuel : {initial.fidelity === "raw"
            ? "HTML brut conservé tel quel"
            : `${initial.sectionsCount} section${initial.sectionsCount > 1 ? "s" : ""} éditoriales`}
        </p>
      )}

      <AnimatePresence>
        {state.status === "error" && state.error && (
          <motion.p
            key={state.error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="border-l-2 border-red-400/40 pl-4 text-[11px] uppercase tracking-[0.32em] text-red-300/80"
          >
            {state.error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between border-t border-white/10 pt-6">
        <Link
          href="/admin/templates"
          className="text-[11px] uppercase tracking-[0.32em] text-white/40 hover:text-white"
        >
          Annuler
        </Link>
        <SubmitButton hasNewFile={hasNewFile} fidelity={fidelity} />
      </div>
    </motion.form>
  );
}
