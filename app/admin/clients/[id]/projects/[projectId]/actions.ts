"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PageContent } from "@/types/database";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "page-media";

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
