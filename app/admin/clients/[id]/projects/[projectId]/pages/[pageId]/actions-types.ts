/**
 * Types utilisés par les Server Actions de l'éditeur de page.
 *
 * Séparés du fichier `actions.ts` car un fichier marqué `"use server"`
 * ne peut exporter QUE des async functions (toute autre valeur exports
 * déclenche une erreur Next.js au build). Les types sont effacés à la
 * compilation, donc OK ici.
 */
import type { Section } from "@/lib/section-types";

export type ActionContext = {
  profileId: string;
  projectId: string;
  pageId: string;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type SectionResult =
  | { ok: true; section: Section }
  | { ok: false; error: string };

export type SectionListResult =
  | { ok: true; sections: Section[] }
  | { ok: false; error: string };
