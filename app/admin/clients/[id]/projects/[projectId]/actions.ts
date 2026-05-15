"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PageContent } from "@/types/database";
import type {
  ProjectLotInsert,
  ProjectLotRow,
} from "./_lib/lot-types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "page-media";
const MAX_LOT_NAME_LEN = 80;

type DeleteProjectInput = {
  profileId: string;
  projectId: string;
};

export type DeleteProjectResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireOwnerAndAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Session expirée. Reconnecte-toi." };
  }

  const ownerEmail = process.env.SPEETCH_OWNER_EMAIL?.toLowerCase();
  if (ownerEmail && user.email?.toLowerCase() !== ownerEmail) {
    return { ok: false as const, error: "Accès réservé au propriétaire." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      error:
        "SUPABASE_SERVICE_ROLE_KEY manquant — impossible d'écrire dans Supabase.",
    };
  }

  return { ok: true as const, admin: createAdminClient() };
}

function extractStoragePath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}

/**
 * Supprime un projet et tous ses contenus :
 *  - les pages sont supprimées automatiquement (FK pages.project_id on delete cascade)
 *  - le bucket page-media contient deux familles de fichiers liés au projet :
 *    1. `projects/{projectId}/...` (médiathèque)
 *    2. n'importe quel chemin référencé dans une section.media des pages
 *  → on liste les deux et on les remove avant le DELETE.
 */
export async function deleteProject(
  input: DeleteProjectInput,
): Promise<DeleteProjectResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }

  // Vérifie que le projet appartient bien à ce client.
  const { data: project, error: fetchError } = await auth.admin
    .from("projects")
    .select("id, profile_id")
    .eq("id", input.projectId)
    .maybeSingle();

  if (fetchError || !project) {
    return { ok: false, error: "Projet introuvable." };
  }
  if (project.profile_id !== input.profileId) {
    return { ok: false, error: "Projet introuvable." };
  }

  // 1) Collecte tous les chemins de média référencés par les pages du projet.
  const { data: pages } = await auth.admin
    .from("pages")
    .select("content")
    .eq("project_id", input.projectId);

  const mediaPaths = new Set<string>();
  for (const p of pages ?? []) {
    const content = (p.content as PageContent) ?? {};
    for (const section of content.sections ?? []) {
      for (const m of section.media ?? []) {
        const path = extractStoragePath(m.url);
        if (path) mediaPaths.add(path);
      }
    }
  }

  // 2) Liste la médiathèque du projet (bucket page-media → projects/{id}/...).
  const { data: libFiles } = await auth.admin.storage
    .from(BUCKET)
    .list(`projects/${input.projectId}`, { limit: 1000 });
  for (const f of libFiles ?? []) {
    if (f.name && !f.name.startsWith(".")) {
      mediaPaths.add(`projects/${input.projectId}/${f.name}`);
    }
  }

  // 3) Remove. Supabase storage accepte un batch jusqu'à 1000 paths.
  if (mediaPaths.size > 0) {
    const paths = Array.from(mediaPaths);
    const { error: removeError } = await auth.admin.storage
      .from(BUCKET)
      .remove(paths);
    if (removeError) {
      console.error("[deleteProject] storage.remove error:", removeError);
      // On n'arrête pas — même si le storage cleanup partiel échoue, on supprime
      // le projet en DB pour ne pas laisser de zombie.
    }
  }

  // 4) DELETE projet (les pages cascade-delete via la FK).
  const { error } = await auth.admin
    .from("projects")
    .delete()
    .eq("id", input.projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.profileId}/projects/${input.projectId}`);
  return { ok: true };
}

export type ReorderProjectPagesResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Met à jour la colonne `position` des pages d'un projet pour refléter
 * l'ordre passé. Aucune contrainte d'unicité sur (project_id, position) →
 * tolère les états intermédiaires pendant la séquence d'updates.
 *
 * Garde-fous :
 *  - la liste doit contenir exactement toutes les pages du projet
 *  - pas de doublons, pas d'id étranger au projet
 *  - max 200 entrées pour éviter une boucle pathologique
 */
export async function reorderProjectPages(input: {
  profileId: string;
  projectId: string;
  pageIds: string[];
}): Promise<ReorderProjectPagesResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!Array.isArray(input.pageIds) || input.pageIds.length === 0) {
    return { ok: false, error: "Liste de pages vide." };
  }
  if (input.pageIds.length > 200) {
    return { ok: false, error: "Trop de pages (max 200)." };
  }
  if (!input.pageIds.every((id) => UUID_REGEX.test(id))) {
    return { ok: false, error: "Identifiant de page invalide." };
  }
  if (new Set(input.pageIds).size !== input.pageIds.length) {
    return { ok: false, error: "Doublons dans la liste." };
  }

  // Vérifie que le projet appartient bien à ce client.
  const { data: project } = await auth.admin
    .from("projects")
    .select("id, profile_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project || project.profile_id !== input.profileId) {
    return { ok: false, error: "Projet introuvable." };
  }

  // La liste reçue doit correspondre EXACTEMENT aux pages du projet :
  //  - même cardinalité (pas de page manquante ni en trop)
  //  - pas d'id étranger au projet
  const { data: existing } = await auth.admin
    .from("pages")
    .select("id")
    .eq("project_id", input.projectId);
  const existingIds = new Set((existing ?? []).map((p) => p.id));
  if (existingIds.size !== input.pageIds.length) {
    return {
      ok: false,
      error: "Liste incohérente avec les pages du projet (rechargement requis).",
    };
  }
  for (const id of input.pageIds) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Page introuvable dans ce projet." };
    }
  }

  for (let i = 0; i < input.pageIds.length; i++) {
    const { error } = await auth.admin
      .from("pages")
      .update({ position: i })
      .eq("id", input.pageIds[i])
      .eq("project_id", input.projectId);
    if (error) {
      console.error("[reorderProjectPages] update error:", error);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath(`/admin/clients/${input.profileId}/projects/${input.projectId}`);
  return { ok: true };
}

export type ReorderProjectContextsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Met à jour la `position` des notes publiées sur un projet pour refléter
 * l'ordre passé. Toutes les notes fournies doivent appartenir au client et
 * être déjà rattachées au projet (project_id = projectId).
 */
export async function reorderProjectContexts(input: {
  profileId: string;
  projectId: string;
  contextIds: string[];
}): Promise<ReorderProjectContextsResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!Array.isArray(input.contextIds) || input.contextIds.length === 0) {
    return { ok: false, error: "Liste de notes vide." };
  }
  if (input.contextIds.length > 200) {
    return { ok: false, error: "Trop de notes (max 200)." };
  }
  if (!input.contextIds.every((id) => UUID_REGEX.test(id))) {
    return { ok: false, error: "Identifiant de note invalide." };
  }
  if (new Set(input.contextIds).size !== input.contextIds.length) {
    return { ok: false, error: "Doublons dans la liste." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  // Les notes fournies doivent appartenir au client ET être rattachées au projet
  const { data: existing } = await auth.admin
    .from("client_contexts" as never)
    .select("id, profile_id, project_id")
    .eq("project_id", input.projectId)
    .eq("profile_id", input.profileId)
    .returns<
      Array<{ id: string; profile_id: string; project_id: string | null }>
    >();
  const existingIds = new Set((existing ?? []).map((c) => c.id));
  if (existingIds.size !== input.contextIds.length) {
    return {
      ok: false,
      error: "Liste incohérente avec les notes du projet (rechargement requis).",
    };
  }
  for (const id of input.contextIds) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Note introuvable dans ce projet." };
    }
  }

  for (let i = 0; i < input.contextIds.length; i++) {
    const { error } = await auth.admin
      .from("client_contexts" as never)
      .update({ position: i } as never)
      .eq("id", input.contextIds[i]);
    if (error) {
      console.error("[reorderProjectContexts] update error:", error);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true };
}

// ============================================================================
// Lots — groupes ordonnés à l'intérieur d'un projet
// ============================================================================

/**
 * Vérifie qu'un projet appartient bien au client passé. Renvoie le projet
 * ou une erreur. Helper interne — toutes les actions lot sont projet-scopées.
 */
async function ensureProjectOwnership(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: project } = await admin
    .from("projects")
    .select("id, profile_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.profile_id !== profileId) {
    return { ok: false, error: "Projet introuvable." };
  }
  return { ok: true };
}

function normalizeLotName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_LOT_NAME_LEN) {
    return trimmed.slice(0, MAX_LOT_NAME_LEN);
  }
  return trimmed;
}

export type CreateProjectLotResult =
  | { ok: true; lotId: string }
  | { ok: false; error: string };

/**
 * Crée un nouveau lot à la fin de la liste (position = max + 1). Le nom est
 * optionnel — l'UI affichera "Lot N" + nom si présent.
 */
export async function createProjectLot(input: {
  profileId: string;
  projectId: string;
  name?: string | null;
}): Promise<CreateProjectLotResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  // Position suivante = max + 1 parmi les lots existants du projet.
  const { data: maxRow } = await auth.admin
    .from("project_lots" as never)
    .select("position")
    .eq("project_id", input.projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<ProjectLotRow, "position">>();
  const nextPosition = (maxRow?.position ?? -1) + 1;

  const payload: ProjectLotInsert = {
    project_id: input.projectId,
    name: normalizeLotName(input.name),
    position: nextPosition,
  };

  const { data: inserted, error } = await auth.admin
    .from("project_lots" as never)
    .insert(payload as never)
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    console.error("[createProjectLot] insert error:", error);
    return { ok: false, error: error?.message ?? "Création du lot impossible." };
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true, lotId: inserted.id };
}

export type RenameProjectLotResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Renomme un lot (le numéro affiché reste dérivé de `position`, seul le `name`
 * libre change). Passer une chaîne vide / null efface le nom.
 */
export async function renameProjectLot(input: {
  profileId: string;
  projectId: string;
  lotId: string;
  name: string | null;
}): Promise<RenameProjectLotResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!UUID_REGEX.test(input.lotId)) {
    return { ok: false, error: "Lot invalide." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  const normalized = normalizeLotName(input.name);

  const { error } = await auth.admin
    .from("project_lots" as never)
    .update({ name: normalized } as never)
    .eq("id", input.lotId)
    .eq("project_id", input.projectId);

  if (error) {
    console.error("[renameProjectLot] update error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true };
}

export type DeleteProjectLotResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Supprime un lot. Les pages et notes qui y étaient rattachées repassent
 * automatiquement en "Hors lot" via le ON DELETE SET NULL de la FK.
 */
export async function deleteProjectLot(input: {
  profileId: string;
  projectId: string;
  lotId: string;
}): Promise<DeleteProjectLotResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!UUID_REGEX.test(input.lotId)) {
    return { ok: false, error: "Lot invalide." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  const { error } = await auth.admin
    .from("project_lots" as never)
    .delete()
    .eq("id", input.lotId)
    .eq("project_id", input.projectId);

  if (error) {
    console.error("[deleteProjectLot] delete error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true };
}

export type ReorderProjectLotsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Met à jour la `position` de chaque lot du projet pour refléter l'ordre
 * passé. La liste doit contenir exactement tous les lots du projet.
 */
export async function reorderProjectLots(input: {
  profileId: string;
  projectId: string;
  lotIds: string[];
}): Promise<ReorderProjectLotsResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!Array.isArray(input.lotIds) || input.lotIds.length === 0) {
    return { ok: false, error: "Liste de lots vide." };
  }
  if (input.lotIds.length > 200) {
    return { ok: false, error: "Trop de lots (max 200)." };
  }
  if (!input.lotIds.every((id) => UUID_REGEX.test(id))) {
    return { ok: false, error: "Identifiant de lot invalide." };
  }
  if (new Set(input.lotIds).size !== input.lotIds.length) {
    return { ok: false, error: "Doublons dans la liste." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  const { data: existing } = await auth.admin
    .from("project_lots" as never)
    .select("id")
    .eq("project_id", input.projectId)
    .returns<Array<Pick<ProjectLotRow, "id">>>();
  const existingIds = new Set((existing ?? []).map((l) => l.id));
  if (existingIds.size !== input.lotIds.length) {
    return {
      ok: false,
      error: "Liste incohérente avec les lots du projet (rechargement requis).",
    };
  }
  for (const id of input.lotIds) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Lot introuvable dans ce projet." };
    }
  }

  for (let i = 0; i < input.lotIds.length; i++) {
    const { error } = await auth.admin
      .from("project_lots" as never)
      .update({ position: i } as never)
      .eq("id", input.lotIds[i])
      .eq("project_id", input.projectId);
    if (error) {
      console.error("[reorderProjectLots] update error:", error);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true };
}

export type SetPageLotResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Range une page dans un lot du projet, ou la sort de tout lot (lotId=null).
 * On vérifie que page ET lot appartiennent bien au même projet pour éviter
 * tout cross-project. La FK ON DELETE SET NULL fait déjà ce travail si le
 * lot est supprimé après coup.
 */
export async function setPageLot(input: {
  profileId: string;
  projectId: string;
  pageId: string;
  lotId: string | null;
}): Promise<SetPageLotResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!UUID_REGEX.test(input.pageId)) {
    return { ok: false, error: "Page invalide." };
  }
  if (input.lotId !== null && !UUID_REGEX.test(input.lotId)) {
    return { ok: false, error: "Lot invalide." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  // La page doit être dans ce projet
  const { data: page } = await auth.admin
    .from("pages")
    .select("id, project_id")
    .eq("id", input.pageId)
    .maybeSingle();
  if (!page || page.project_id !== input.projectId) {
    return { ok: false, error: "Page introuvable dans ce projet." };
  }

  // Si lotId est fourni, vérifier qu'il appartient au projet
  if (input.lotId !== null) {
    const { data: lot } = await auth.admin
      .from("project_lots" as never)
      .select("id, project_id")
      .eq("id", input.lotId)
      .maybeSingle<Pick<ProjectLotRow, "id" | "project_id">>();
    if (!lot || lot.project_id !== input.projectId) {
      return { ok: false, error: "Lot introuvable dans ce projet." };
    }
  }

  const { error } = await auth.admin
    .from("pages")
    .update({ lot_id: input.lotId } as never)
    .eq("id", input.pageId);

  if (error) {
    console.error("[setPageLot] update error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true };
}

export type SetContextLotResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Range une note dans un lot du projet, ou la sort de tout lot (lotId=null).
 * La note doit déjà être publiée sur ce projet (project_id = projectId) —
 * sinon on refuse, l'admin doit d'abord publier la note via la page de la
 * note.
 */
export async function setContextLot(input: {
  profileId: string;
  projectId: string;
  contextId: string;
  lotId: string | null;
}): Promise<SetContextLotResult> {
  const auth = await requireOwnerAndAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!UUID_REGEX.test(input.profileId)) {
    return { ok: false, error: "Client invalide." };
  }
  if (!UUID_REGEX.test(input.projectId)) {
    return { ok: false, error: "Projet invalide." };
  }
  if (!UUID_REGEX.test(input.contextId)) {
    return { ok: false, error: "Note invalide." };
  }
  if (input.lotId !== null && !UUID_REGEX.test(input.lotId)) {
    return { ok: false, error: "Lot invalide." };
  }

  const ownership = await ensureProjectOwnership(
    auth.admin,
    input.profileId,
    input.projectId,
  );
  if (!ownership.ok) return { ok: false, error: ownership.error };

  // La note doit appartenir au client et être publiée sur ce projet
  const { data: ctx } = await auth.admin
    .from("client_contexts" as never)
    .select("id, profile_id, project_id")
    .eq("id", input.contextId)
    .maybeSingle<{
      id: string;
      profile_id: string;
      project_id: string | null;
    }>();
  if (!ctx || ctx.profile_id !== input.profileId) {
    return { ok: false, error: "Note introuvable." };
  }
  if (ctx.project_id !== input.projectId) {
    return {
      ok: false,
      error: "La note doit d'abord être publiée sur ce projet.",
    };
  }

  if (input.lotId !== null) {
    const { data: lot } = await auth.admin
      .from("project_lots" as never)
      .select("id, project_id")
      .eq("id", input.lotId)
      .maybeSingle<Pick<ProjectLotRow, "id" | "project_id">>();
    if (!lot || lot.project_id !== input.projectId) {
      return { ok: false, error: "Lot introuvable dans ce projet." };
    }
  }

  const { error } = await auth.admin
    .from("client_contexts" as never)
    .update({ lot_id: input.lotId } as never)
    .eq("id", input.contextId);

  if (error) {
    console.error("[setContextLot] update error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(
    `/admin/clients/${input.profileId}/projects/${input.projectId}`,
  );
  return { ok: true };
}
