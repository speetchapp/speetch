/**
 * Types locaux pour la table `project_lots` — pas encore dans la régen
 * Supabase. À régénérer via :
 *
 *   supabase gen types typescript --project-id gnspmcqebsjcfjkxjzeb --schema public
 */

export type ProjectLotRow = {
  id: string;
  project_id: string;
  name: string | null;
  position: number;
  created_at: string;
};

export type ProjectLotInsert = {
  id?: string;
  project_id: string;
  name?: string | null;
  position?: number;
  created_at?: string;
};
