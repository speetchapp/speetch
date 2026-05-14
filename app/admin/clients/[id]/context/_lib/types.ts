/**
 * Types locaux pour la feature `client_contexts`. Définis ici parce que la
 * table n'est pas (encore) dans `Database` auto-généré — à régénérer via :
 *
 *   supabase gen types typescript --project-id gnspmcqebsjcfjkxjzeb --schema public
 *
 * Une fois la régénération faite, ces types peuvent migrer vers la section
 * "Custom Speetch types" en bas de `types/database.ts` ou être supprimés au
 * profit de `Tables<"client_contexts">`.
 */

import type { Json } from "@/types/database";

export type ClientContextRow = {
  id: string;
  profile_id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: Json;
  source_kind: "upload" | "url" | "empty";
  source_url: string | null;
  source_filename: string | null;
  position: number;
  project_id: string | null;
  published_page_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientContextInsert = {
  id?: string;
  profile_id: string;
  title: string;
  slug: string;
  summary?: string | null;
  content?: Json;
  source_kind: "upload" | "url" | "empty";
  source_url?: string | null;
  source_filename?: string | null;
  position?: number;
  project_id?: string | null;
  published_page_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ClientContextSummary = Pick<
  ClientContextRow,
  | "id"
  | "title"
  | "slug"
  | "summary"
  | "source_kind"
  | "source_url"
  | "source_filename"
  | "position"
  | "project_id"
  | "published_page_id"
  | "created_at"
  | "updated_at"
>;
